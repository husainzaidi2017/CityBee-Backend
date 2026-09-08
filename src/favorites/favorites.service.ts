import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';

export class FavoriteToggleError extends BadRequestException {}

@Injectable()
export class FavoritesService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  /** Idempotent favorite; exactly one of businessId/offerId/placeId. */
  async add(userId: string, target: { businessId?: string; offerId?: string; placeId?: string }) {
    const picks = Object.values(target).filter(Boolean);
    if (picks.length !== 1) {
      throw new BadRequestException('Provide exactly one of businessId, offerId or placeId');
    }
    const uuid = (v: string | undefined, label: string) => {
      if (!v) return null;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
        throw new BadRequestException(`${label} must be a UUID`);
      }
      return v;
    };
    const rows = await this.db`
      insert into public.favorites (user_id, business_id, offer_id, place_id)
      values (${userId}::uuid, ${uuid(target.businessId, 'businessId')}::uuid, ${uuid(target.offerId, 'offerId')}::uuid, ${uuid(target.placeId, 'placeId')}::uuid)
      on conflict do nothing
      returning id`;
    // on conflict do nothing + unique constraints: returns [] when duplicate —
    // treat as success (idempotent).
    return { id: rows[0]?.id ?? null, alreadyFavorite: rows.length === 0 };
  }

  async remove(userId: string, favoriteId: string) {
    const rows = await this.db`
      delete from public.favorites
      where id = ${favoriteId}::uuid and user_id = ${userId}::uuid
      returning id`;
    if (!rows.length) throw new NotFoundException('Favorite not found');
    return { id: rows[0].id };
  }

  /** Removes the user's favorite for a target entity (uuid) directly. */
  async removeByEntity(userId: string, target: { businessId?: string; offerId?: string; placeId?: string }) {
    const rows = await this.db`
      delete from public.favorites
      where user_id = ${userId}::uuid
        and (
          (business_id is not null and business_id = ${target.businessId ?? null}::uuid)
          or (offer_id is not null and offer_id = ${target.offerId ?? null}::uuid)
          or (place_id is not null and place_id = ${target.placeId ?? null}::uuid)
        )
      returning id`;
    if (!rows.length) throw new NotFoundException('Favorite not found');
    return { removed: rows.length };
  }

  async list(userId: string) {
    const rows = await this.db`
      select f.id, f.created_at,
        case when f.business_id is not null then 'business' when f.offer_id is not null then 'offer' else 'place' end as target_type,
        b.slug as business_slug, b.name as business_name, b.locality, b.rating,
        (select image_url from public.business_images bi where bi.business_id = b.id order by bi.is_primary desc, bi.sort_order limit 1) as image,
        o.title as offer_title, o.badge_text,
        (select image_url from public.offer_images oi where oi.offer_id = o.id order by oi.is_primary desc limit 1) as offer_image,
        p.name as place_name, p.slug as place_slug,
        (select image_url from public.place_images pi where pi.place_id = p.id order by pi.is_primary desc limit 1) as place_image
      from public.favorites f
      left join public.businesses b on b.id = f.business_id
      left join public.offers o on o.id = f.offer_id
      left join public.places p on p.id = f.place_id
      where f.user_id = ${userId}::uuid
      order by f.created_at desc`;
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      targetType: r.target_type,
      business: r.business_slug ? { id: r.business_slug, name: r.business_name, area: r.locality, rating: Number(r.rating), image: r.image } : null,
      offer: r.offer_title ? { id: null, title: r.business_name ?? r.offer_title, badge: r.badge_text, image: r.offer_image } : null,
      place: r.place_slug ? { id: r.place_slug, name: r.place_name, image: r.place_image } : null,
    }));
  }
}
