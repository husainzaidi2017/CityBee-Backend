import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { DiscoveryService } from '../discovery/discovery.service';

/**
 * Offers are returned joined with their business so the Flutter card can
 * render title + area + distance + image without extra round-trips.
 */
@Injectable()
export class OffersService {
  constructor(
    @Inject(DATABASE) private readonly db: Sql,
    private readonly discovery: DiscoveryService,
  ) {}

  private map(row: Record<string, unknown>, distanceM?: number | null) {
    const validUntil = row.valid_until as string | null;
    return {
      id: row.id,
      businessId: (row.business_slug ?? row.business_id) as string,
      businessUuid: row.business_id,
      title: row.business_name, // card title mirrors the mock data (business name)
      offerTitle: row.title,
      badgeText: row.badge_text,
      subtitle: row.subtitle,
      description: row.description,
      couponCode: row.coupon_code,
      categoryTag: row.category_tag,
      validityText: validUntil ? `Valid till ${new Date(validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Limited time offer',
      image: row.image,
      rating: Number(row.rating),
      area: row.locality ?? '',
      cityName: row.city_name ?? '',
      distanceText: distanceM != null ? `${(distanceM / 1000).toFixed(1)} km` : null,
      featured: row.is_featured,
    };
  }

  async findMany(opts: PaginationDto & { tag?: string; citySlug?: string; featured?: boolean }) {
    const offset = (opts.page - 1) * opts.limit;
    const rows = await this.db`
      select o.id, o.title, o.description, o.badge_text, o.subtitle, o.coupon_code,
        o.category_tag, o.valid_until, o.is_featured,
        (select image_url from public.offer_images oi where oi.offer_id = o.id order by oi.is_primary desc, oi.sort_order limit 1) as image,
        b.id as business_id, b.slug as business_slug, b.name as business_name,
        b.rating, b.locality,
        count(*) over () as total_rows
      from public.offers o
      join public.businesses b on b.id = o.business_id
      where o.status = 'active'
        ${opts.tag && opts.tag !== 'All' ? this.db`and o.category_tag = ${opts.tag}` : this.db``}
        ${opts.featured != null ? this.db`and o.is_featured = ${opts.featured}` : this.db``}
        ${opts.citySlug ? this.db`and b.city_id = (select id from public.cities where slug = ${opts.citySlug})` : this.db``}
      order by o.is_featured desc, o.created_at desc
      limit ${opts.limit} offset ${offset}`;
    const total = rows.length ? Number(rows[0].total_rows) : 0;
    return paginate(rows.map((r) => this.map(r)), total, opts.page, opts.limit);
  }

  async nearby(q: PaginationDto & { lat: number; lng: number; radius?: number }) {
    // Progressive expansion when the caller doesn't pin a radius.
    const radius = q.radius ?? (await this.discovery.effectiveRadius(q.lat, q.lng, { entity: 'offer' }));
    const offset = (q.page - 1) * q.limit;
    const point = this.db`st_setsrid(st_makepoint(${q.lng}, ${q.lat}), 4326)::geography`;
    const rows = await this.db`
      select o.id, o.title, o.description, o.badge_text, o.subtitle, o.coupon_code,
        o.category_tag, o.valid_until, o.is_featured,
        (select image_url from public.offer_images oi where oi.offer_id = o.id order by oi.is_primary desc, oi.sort_order limit 1) as image,
        b.id as business_id, b.slug as business_slug, b.name as business_name,
        b.rating, b.locality,
        (select c.name from public.cities c where c.id = b.city_id) as city_name,
        st_distance(b.location, ${point}) as distance_m,
        count(*) over () as total_rows
      from public.offers o
      join public.businesses b on b.id = o.business_id
      where o.status = 'active' and b.location is not null
        and st_dwithin(b.location, ${point}, ${radius})
      order by b.location <-> ${point}
      limit ${q.limit} offset ${offset}`;
    const total = rows.length ? Number(rows[0].total_rows) : 0;
    const page = paginate(rows.map((r) => this.map(r, r.distance_m)), total, q.page, q.limit);
    return { ...page, searchRadiusKm: radius / 1000 };
  }

  async findByIdOrSlug(id: string) {
    const rows = await this.db`
      select o.*, b.id as business_id, b.slug as business_slug, b.name as business_name,
        b.rating, b.locality, b.phone, b.whatsapp, b.address, b.latitude as biz_lat, b.longitude as biz_lng,
        st_y(b.location::geometry) as lat, st_x(b.location::geometry) as lng,
        (select json_agg(json_build_object('url', oi.image_url) order by oi.is_primary desc, oi.sort_order)
         from public.offer_images oi where oi.offer_id = o.id) as images
      from public.offers o
      join public.businesses b on b.id = o.business_id
      where o.id = ${id}::uuid and o.status = 'active'
      limit 1`;
    if (!rows.length) throw new NotFoundException('Offer not found');
    const r = rows[0];
    return {
      ...this.map(r),
      images: r.images ?? [],
      business: {
        id: r.business_slug ?? r.business_id,
        name: r.business_name,
        phone: r.phone ?? '',
        whatsapp: r.whatsapp ?? '',
        address: r.address,
        latitude: r.lat,
        longitude: r.lng,
        rating: Number(r.rating),
      },
    };
  }

  async countActive(citySlug?: string, coords?: { lat: number; lng: number }) {
    if (coords) {
      // Count within the effective discovery radius around the coordinates.
      const radius = await this.discovery.effectiveRadius(coords.lat, coords.lng, { entity: 'offer' });
      const point = this.db`st_setsrid(st_makepoint(${coords.lng}, ${coords.lat}), 4326)::geography`;
      const rows = await this.db`
        select count(*)::int as n from public.offers o join public.businesses b on b.id = o.business_id
        where o.status = 'active' and b.location is not null
          and st_dwithin(b.location, ${point}, ${radius})`;
      return rows[0].n;
    }
    const rows = await this.db`
      select count(*)::int as n from public.offers o join public.businesses b on b.id = o.business_id
      where o.status = 'active'
      ${citySlug ? this.db`and b.city_id = (select id from public.cities where slug = ${citySlug})` : this.db``}`;
    return rows[0].n;
  }
}
