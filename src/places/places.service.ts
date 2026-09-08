import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { DiscoveryService } from '../discovery/discovery.service';

@Injectable()
export class PlacesService {
  constructor(
    @Inject(DATABASE) private readonly db: Sql,
    private readonly discovery: DiscoveryService,
  ) {}

  private map(row: Record<string, unknown>, distanceM?: number | null) {
    const rating = Number(row.rating);
    const rc = Number(row.review_count);
    const compact = rc >= 1000 ? `${(rc / 1000).toFixed(1)}K` : String(rc);
    const distanceMin = distanceM != null ? Math.max(1, Math.round(distanceM / 400)) : null; // ~12km/h walk
    const parts = [
      distanceMin != null ? `${distanceMin} min` : null,
      (row.entry_fee as string)?.toLowerCase().includes('free') || !row.entry_fee ? 'Free' : (row.entry_fee as string),
      row.is_featured ? 'Must Visit' : null,
    ].filter(Boolean);
    return {
      id: row.slug ?? row.id,
      uuid: row.id,
      name: row.name,
      image: row.image,
      metaLine: parts.join(' · '),
      description: row.description,
      ratingText: `${rating.toFixed(1)} (${compact})`,
      tags: row.tags ?? [],
      address: row.address ?? '',
      cityName: row.city_name ?? '',
      timings: row.timings ?? '',
      entryFee: row.entry_fee ?? '',
      latitude: row.lat,
      longitude: row.lng,
      distanceKm: distanceM != null ? Math.round((distanceM / 1000) * 10) / 10 : null,
    };
  }

  async findMany(opts: PaginationDto & { citySlug?: string; featured?: boolean }) {
    const offset = (opts.page - 1) * opts.limit;
    const rows = await this.db`
      select p.id, p.slug, p.name, p.description, p.rating, p.review_count, p.address,
        p.timings, p.entry_fee, p.is_featured,
        st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
        (select image_url from public.place_images pi where pi.place_id = p.id order by pi.is_primary desc, pi.sort_order limit 1) as image,
        coalesce((select json_agg(c.slug) from public.categories c where c.id = p.category_id), '[]') as tags,
        count(*) over () as total_rows
      from public.places p
      where p.is_active
        ${opts.citySlug ? this.db`and p.city_id = (select id from public.cities where slug = ${opts.citySlug})` : this.db``}
        ${opts.featured != null ? this.db`and p.is_featured = ${opts.featured}` : this.db``}
      order by p.is_featured desc, p.rating desc
      limit ${opts.limit} offset ${offset}`;
    const total = rows.length ? Number(rows[0].total_rows) : 0;
    return paginate(rows.map((r) => this.map(r)), total, opts.page, opts.limit);
  }

  async nearby(q: PaginationDto & { lat: number; lng: number; radius?: number }) {
    const radius = q.radius ?? (await this.discovery.effectiveRadius(q.lat, q.lng, { entity: 'place' }));
    const offset = (q.page - 1) * q.limit;
    const point = this.db`st_setsrid(st_makepoint(${q.lng}, ${q.lat}), 4326)::geography`;
    const rows = await this.db`
      select p.id, p.slug, p.name, p.description, p.rating, p.review_count, p.address,
        p.timings, p.entry_fee, p.is_featured,
        st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
        (select c.name from public.cities c where c.id = p.city_id) as city_name,
        st_distance(p.location, ${point}) as distance_m,
        (select image_url from public.place_images pi where pi.place_id = p.id order by pi.is_primary desc, pi.sort_order limit 1) as image,
        coalesce((select json_agg(c.slug) from public.categories c where c.id = p.category_id), '[]') as tags,
        count(*) over () as total_rows
      from public.places p
      where p.is_active and p.location is not null
        and st_dwithin(p.location, ${point}, ${radius})
      order by p.location <-> ${point}
      limit ${q.limit} offset ${offset}`;
    const total = rows.length ? Number(rows[0].total_rows) : 0;
    const page = paginate(rows.map((r) => this.map(r, r.distance_m)), total, q.page, q.limit);
    return { ...page, searchRadiusKm: radius / 1000 };
  }

  async search(q: string, opts: PaginationDto) {
    const term = `%${q.trim()}%`;
    const offset = (opts.page - 1) * opts.limit;
    const rows = await this.db`
      select p.id, p.slug, p.name, p.description, p.rating, p.review_count, p.address,
        p.timings, p.entry_fee, p.is_featured,
        st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
        (select image_url from public.place_images pi where pi.place_id = p.id order by pi.is_primary desc, pi.sort_order limit 1) as image,
        coalesce((select json_agg(c.slug) from public.categories c where c.id = p.category_id), '[]') as tags,
        count(*) over () as total_rows
      from public.places p
      where p.is_active and (p.name ilike ${term} or p.description ilike ${term})
      order by p.rating desc
      limit ${opts.limit} offset ${offset}`;
    const total = rows.length ? Number(rows[0].total_rows) : 0;
    return paginate(rows.map((r) => this.map(r)), total, opts.page, opts.limit);
  }

  async findOne(idOrSlug: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const rows = await this.db`
      select p.*, st_y(p.location::geometry) as lat, st_x(p.location::geometry) as lng,
        (select json_agg(json_build_object('url', pi.image_url) order by pi.is_primary desc, pi.sort_order)
         from public.place_images pi where pi.place_id = p.id) as images,
        coalesce((select json_agg(c.slug) from public.categories c where c.id = p.category_id), '[]') as tags
      from public.places p
      where p.is_active and ${isUuid ? this.db`p.id = ${idOrSlug}::uuid` : this.db`p.slug = ${idOrSlug}`}
      limit 1`;
    if (!rows.length) throw new NotFoundException('Place not found');
    return { ...this.map(rows[0]), images: rows[0].images ?? [] };
  }
}
