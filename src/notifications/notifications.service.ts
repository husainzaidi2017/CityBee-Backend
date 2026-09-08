import { Inject, Injectable } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';

@Injectable()
export class NotificationsService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  /**
   * Personal notifications plus broadcasts (user_id is null). Shape mirrors
   * the Flutter NotificationPayload: `{ type, id }` maps onto
   * target_type/target_id so taps deep-link to the right screen.
   */
  async list(userId: string, limit = 30) {
    const rows = await this.db`
      select n.id, n.title, n.message, n.type, n.target_type, n.target_id, n.is_read, n.created_at,
        b.slug as business_slug, p.slug as place_slug, o.title as offer_title
      from public.notifications n
      left join public.businesses b on b.id = n.target_id and n.target_type = 'business'
      left join public.offers o on o.id = n.target_id and n.target_type = 'offer'
      left join public.places p on p.id = n.target_id and n.target_type = 'place'
      where n.user_id = ${userId}::uuid or n.user_id is null
      order by n.created_at desc
      limit ${limit}`;
    return rows.map((r) => {
      const slug =
        r.target_type === 'business' ? r.business_slug :
        r.target_type === 'place' ? (r as Record<string, string>).place_slug :
        null; // offers are addressed by uuid in deep links for now
      return {
        id: r.id,
        title: r.title,
        body: r.message,
        type: r.type,
        isRead: r.is_read,
        createdAt: r.created_at,
        // Flutter payload contract: {"type": "offer", "id": "..."}.
        payload: {
          type: r.target_type ?? 'offers_tab',
          id: slug ?? r.target_id,
        },
      };
    });
  }

  async markRead(userId: string, notificationId: string) {
    const rows = await this.db`
      update public.notifications set is_read = true
      where id = ${notificationId}::uuid and user_id = ${userId}::uuid
      returning id, is_read`;
    return rows[0] ?? null;
  }

  async markAllRead(userId: string) {
    const rows = await this.db`
      update public.notifications set is_read = true
      where user_id = ${userId}::uuid and is_read = false
      returning id`;
    return { updated: rows.length };
  }
}
