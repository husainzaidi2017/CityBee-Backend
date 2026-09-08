import { Inject, Injectable } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';

@Injectable()
export class CategoriesService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  async findMany() {
    const rows = await this.db`
      select c.slug, c.name, c.sort_order,
        (select count(*)::int from public.business_categories bc
          join public.businesses b on b.id = bc.business_id
          where bc.category_id = c.id and b.status = 'approved') as business_count
      from public.categories c
      where c.is_active
      order by c.sort_order`;
    return rows.map((c) => ({
      id: c.slug,
      name: c.name,
      listingTitle: `${c.name} in Moradabad`.replace(' in Moradabad', ''), // listing titles come from Flutter; id/name are the contract
      businessCount: c.business_count,
    }));
  }

  async findOne(idOrSlug: string) {
    const rows = await this.db`
      select slug, name, description, icon, sort_order from public.categories
      where slug = ${idOrSlug} and is_active limit 1`;
    return rows[0] ?? null;
  }
}
