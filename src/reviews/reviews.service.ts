import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';

@Injectable()
export class ReviewsService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  async listForBusiness(businessIdOrSlug: string) {
    const biz = await this.resolveBusiness(businessIdOrSlug);
    const rows = await this.db`
      select rv.id, rv.rating, rv.review_text, rv.created_at,
             coalesce(u.name, 'CityBee user') as author, u.profile_image_url as avatar
      from public.reviews rv
      left join public.users u on u.id = rv.user_id
      where rv.business_id = ${biz}::uuid and rv.status = 'approved'
      order by rv.created_at desc
      limit 50`;
    return rows.map((r) => ({
      id: r.id,
      author: r.author,
      rating: Number(r.rating),
      text: r.review_text,
      createdAt: r.created_at,
      avatar: r.avatar,
    }));
  }

  async create(userId: string, businessIdOrSlug: string, dto: { rating: number; text?: string }) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    const biz = await this.resolveBusiness(businessIdOrSlug);
    const user = await this.db`select name from public.users where id = ${userId}::uuid`;
    if (!user.length) throw new ForbiddenException('Profile not initialized');

    const rows = await this.db`
      insert into public.reviews (user_id, business_id, rating, review_text, status)
      values (${userId}::uuid, ${biz}::uuid, ${dto.rating}, ${dto.text ?? null}, 'approved')
      on conflict do nothing
      returning id, rating, review_text, created_at`;

    if (!rows.length) {
      throw new BadRequestException('You already reviewed this business');
    }

    // Keep the denormalized aggregate fresh for listing cards.
    await this.db`
      update public.businesses b set
        review_count = (select count(*) from public.reviews rv where rv.business_id = b.id and rv.status = 'approved'),
        rating = coalesce((select round(avg(rv.rating)::numeric, 1) from public.reviews rv where rv.business_id = b.id and rv.status = 'approved'), 0)
      where b.id = ${biz}::uuid`;

    return { id: rows[0].id, rating: Number(rows[0].rating), text: rows[0].review_text, createdAt: rows[0].created_at, author: user[0].name };
  }

  private async resolveBusiness(idOrSlug: string): Promise<string> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const rows = await this.db`
      select id from public.businesses
      where ${isUuid ? this.db`id = ${idOrSlug}::uuid` : this.db`slug = ${idOrSlug}`} and status = 'approved'
      limit 1`;
    if (!rows.length) throw new NotFoundException('Business not found');
    return rows[0].id as string;
  }
}
