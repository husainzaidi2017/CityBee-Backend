import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Fragment, Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { BusinessRow, toBusiness } from './business.mapper';

export interface NearbyQuery extends PaginationDto {
  lat: number;
  lng: number;
  radius: number; // meters
  categorySlug?: string;
  kind?: string;
}

/**
 * All business reads go through one base select so every endpoint returns
 * the same shape: business + doctor/hotel/restaurant extensions + images +
 * category slugs. Implemented as a nested postgres.js fragment (template
 * tag), which keeps every interpolated value parameterized.
 */
@Injectable()
export class BusinessesService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  /** Shared select list + base joins. Embed with `${this.baseSelect()}`. */
  private baseSelect(extras: Fragment[] = []) {
    return this.db`
      select
        b.id, b.slug, b.name, b.kind, b.tagline, b.description, b.phone, b.whatsapp,
        b.website, b.address, b.locality, b.rating, b.review_count, b.opening_hours,
        b.is_pure_veg, b.is_verified, b.is_featured,
        st_y(b.location::geometry) as latitude,
        st_x(b.location::geometry) as longitude,
        d.name as doctor_name, d.specialization as doctor_specialization,
        d.qualification as doctor_qualification, d.experience_years as doctor_experience_years,
        d.consultation_fee as doctor_consultation_fee, d.bio as doctor_bio,
        h.hotel_type as hotel_type, h.price_range as hotel_price_range,
        r.cuisine as restaurant_cuisine, r.price_range as restaurant_price_range,
        r.veg_type as restaurant_veg_type,
        coalesce(
          (select json_agg(json_build_object('url', bi.image_url, 'public_id', bi.public_id) order by bi.is_primary desc, bi.sort_order)
           from public.business_images bi where bi.business_id = b.id), '[]') as images,
        coalesce(
          (select json_agg(ha.amenity) from public.hotel_amenities ha
           join public.hotels hh on hh.id = ha.hotel_id where hh.business_id = b.id), '[]') as amenities,
        coalesce(
          (select json_agg(c.slug) from public.business_categories bc
           join public.categories c on c.id = bc.category_id where bc.business_id = b.id), '[]') as category_slugs
        ${extras.length > 0 ? this.db`, ${extras[0]}` : this.db``}
        ${extras.length > 1 ? this.db`, ${extras[1]}` : this.db``}
      from public.businesses b
      left join public.doctors d on d.business_id = b.id
      left join public.hotels h on h.business_id = b.id
      left join public.restaurants r on r.business_id = b.id
    `;
  }

  private point(lat: number, lng: number) {
    return this.db`st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`;
  }

  private static mapRow(row: Record<string, unknown>): BusinessRow {
    return {
      ...(row as unknown as BusinessRow),
      doctor: row.doctor_name
        ? {
            name: row.doctor_name as string,
            specialization: row.doctor_specialization as string,
            qualification: row.doctor_qualification as string | null,
            experience_years: row.doctor_experience_years as number | null,
            consultation_fee: row.doctor_consultation_fee as string | null,
            bio: row.doctor_bio as string | null,
          }
        : null,
      hotel: row.hotel_type
        ? {
            hotel_type: row.hotel_type as string | null,
            price_range: row.hotel_price_range as string | null,
            amenities: (row.amenities as string[]) ?? [],
          }
        : null,
      restaurant: row.restaurant_cuisine
        ? {
            cuisine: row.restaurant_cuisine as string | null,
            price_range: row.restaurant_price_range as string | null,
            veg_type: row.restaurant_veg_type as string | null,
          }
        : null,
    } as BusinessRow;
  }

  async findMany(opts: {
    page: number;
    limit: number;
    categorySlug?: string;
    citySlug?: string;
    kind?: string;
    featured?: boolean;
    lat?: number;
    lng?: number;
  }) {
    const offset = (opts.page - 1) * opts.limit;
    const withDistance = opts.lat != null && opts.lng != null;
    const point = withDistance ? this.point(opts.lat!, opts.lng!) : null;
    const extras: Fragment[] = [this.db`(select count(*) over () as total_rows) as total_rows`];
    if (point) extras.push(this.db`st_distance(b.location, ${point}) as distance_m`);
    const rows = (await this.db`
      ${this.baseSelect(extras)}
      where b.status = 'approved'
        ${opts.categorySlug ? this.db`and exists (select 1 from public.business_categories bc join public.categories c on c.id = bc.category_id where bc.business_id = b.id and c.slug = ${opts.categorySlug})` : this.db``}
        ${opts.citySlug ? this.db`and b.city_id = (select id from public.cities where slug = ${opts.citySlug})` : this.db``}
        ${opts.kind ? this.db`and b.kind = ${opts.kind}` : this.db``}
        ${opts.featured != null ? this.db`and b.is_featured = ${opts.featured}` : this.db``}
      order by b.is_featured desc, b.rating desc
      limit ${opts.limit} offset ${offset}
    `) as Record<string, unknown>[];

    const total = rows.length ? Number(rows[0].total_rows) : 0;
    return paginate(rows.map(BusinessesService.mapRow).map(toBusiness), total, opts.page, opts.limit);
  }

  async nearby(q: NearbyQuery) {
    const offset = (q.page - 1) * q.limit;
    const point = this.point(q.lat, q.lng);
    const rows = (await this.db`
      ${this.baseSelect([
        this.db`st_distance(b.location, ${point}) as distance_m`,
        this.db`(select count(*) over () as total_rows) as total_rows`,
      ])}
      where b.status = 'approved'
        and b.location is not null
        and st_dwithin(b.location, ${point}, ${q.radius})
        ${q.categorySlug ? this.db`and exists (select 1 from public.business_categories bc join public.categories c on c.id = bc.category_id where bc.business_id = b.id and c.slug = ${q.categorySlug})` : this.db``}
        ${q.kind ? this.db`and b.kind = ${q.kind}` : this.db``}
      order by b.location <-> ${point}
      limit ${q.limit} offset ${offset}
    `) as Record<string, unknown>[];

    const total = rows.length ? Number(rows[0].total_rows) : 0;
    return paginate(rows.map(BusinessesService.mapRow).map(toBusiness), total, q.page, q.limit);
  }

  async search(query: string, opts: { page: number; limit: number; citySlug?: string }) {
    const q = `%${query.trim()}%`;
    const offset = (opts.page - 1) * opts.limit;
    const rows = (await this.db`
      ${this.baseSelect([this.db`(select count(*) over () as total_rows) as total_rows`])}
      where b.status = 'approved'
        and (
          b.name ilike ${q}
          or b.tagline ilike ${q}
          or b.locality ilike ${q}
          or d.specialization ilike ${q}
          or r.cuisine ilike ${q}
        )
        ${opts.citySlug ? this.db`and b.city_id = (select id from public.cities where slug = ${opts.citySlug})` : this.db``}
      order by b.rating desc
      limit ${opts.limit} offset ${offset}
    `) as Record<string, unknown>[];

    const total = rows.length ? Number(rows[0].total_rows) : 0;
    return paginate(rows.map(BusinessesService.mapRow).map(toBusiness), total, opts.page, opts.limit);
  }

  async findByIdOrSlug(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const rows = (await this.db`
      ${this.baseSelect()}
      where ${isUuid ? this.db`b.id = ${idOrSlug}::uuid` : this.db`b.slug = ${idOrSlug}`}
        and b.status = 'approved'
      limit 1
    `) as Record<string, unknown>[];

    if (!rows.length) throw new NotFoundException('Business not found');
    const row = BusinessesService.mapRow(rows[0]);

    const menu = await this.db`
      select name, description, price, image_url, is_veg from public.menu_items
      where business_id = ${row.id}::uuid order by sort_order`;
    const reviews = await this.db`
      select rv.id, rv.rating, rv.review_text, rv.created_at,
             coalesce(u.name, 'CityBee user') as author, u.id as user_id
      from public.reviews rv left join public.users u on u.id = rv.user_id
      where rv.business_id = ${row.id}::uuid and rv.status = 'approved'
      order by rv.created_at desc limit 20`;

    return {
      ...toBusiness(row),
      menu: menu.map((m) => ({
        name: m.name,
        description: m.description,
        price: m.price,
        image: m.image_url,
        isVeg: m.is_veg,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        author: r.author,
        rating: Number(r.rating),
        text: r.review_text,
        timeAgo: r.created_at,
      })),
    };
  }
}
