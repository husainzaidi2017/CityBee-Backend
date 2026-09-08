import { Inject, Injectable, Logger } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { BusinessRow, toBusiness } from '../businesses/business.mapper';

/**
 * Category-wise dynamic radius search.
 *
 * Business rule (spec): for every category, search progressively wider around
 * the selected location and stop as soon as the category has "enough"
 * results. One category's radius NEVER affects another's.
 *
 *   Level 1: 5 km   Level 2: 10 km   Level 3: 25 km   Level 4: 50 km   Level 5: 100 km
 *
 * Stop at the first level where count >= MIN results (target caps the payload
 * size). Defaults and per-category overrides are configurable via env:
 *
 *   DISCOVERY_DEFAULT_MIN_RESULTS (default 5)
 *   DISCOVERY_DEFAULT_TARGET_RESULTS (default 10)
 */
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  /** Progressive radius levels in meters — small → large. */
  static readonly RADII_METERS = [5_000, 10_000, 25_000, 50_000, 100_000];

  /** Per-category stop/target overrides; categories not listed use defaults. */
  static readonly CATEGORY_OVERRIDES: Record<string, { min: number; target: number }> = {
    doctors: { min: 3, target: 10 },
    dining: { min: 5, target: 15 },
    hotels: { min: 3, target: 10 },
  };

  private readonly defaultMin: number;
  private readonly defaultTarget: number;

  constructor(@Inject(DATABASE) private readonly db: Sql) {
    this.defaultMin = parseInt(process.env.DISCOVERY_DEFAULT_MIN_RESULTS ?? '5', 10);
    this.defaultTarget = parseInt(process.env.DISCOVERY_DEFAULT_TARGET_RESULTS ?? '10', 10);
  }

  limitsFor(categorySlug?: string): { min: number; target: number } {
    if (categorySlug && DiscoveryService.CATEGORY_OVERRIDES[categorySlug]) {
      return DiscoveryService.CATEGORY_OVERRIDES[categorySlug];
    }
    return { min: this.defaultMin, target: this.defaultTarget };
  }

  /**
   * Smallest radius level where the entity count reaches the category min.
   * One query counts every level at once (FILTER over distance buckets).
   */
  async effectiveRadius(
    lat: number,
    lng: number,
    opts: { categorySlug?: string; kind?: string; entity?: 'business' | 'place' | 'offer' } = {},
  ): Promise<number> {
    const { min } = this.limitsFor(opts.categorySlug);
    const point = this.db`st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`;
    const entity = opts.entity ?? 'business';

    const counts = await this.db`
      select
        count(*) filter (where d <= ${DiscoveryService.RADII_METERS[0]}) as c0,
        count(*) filter (where d <= ${DiscoveryService.RADII_METERS[1]}) as c1,
        count(*) filter (where d <= ${DiscoveryService.RADII_METERS[2]}) as c2,
        count(*) filter (where d <= ${DiscoveryService.RADII_METERS[3]}) as c3
      from (
        select ${
          entity === 'business'
            ? this.db`st_distance(b.location, ${point}) as d`
            : entity === 'offer'
              ? this.db`st_distance(b.location, ${point}) as d`
              : this.db`st_distance(p.location, ${point}) as d`
        }
        from ${
          entity === 'place'
            ? this.db`public.places p`
            : this.db`public.businesses b`
        }
        ${
          entity === 'offer'
            ? this.db`join public.offers o on o.business_id = b.id`
            : this.db``
        }
        where ${
          entity === 'offer'
            ? this.db`o.status = 'active' and b.location is not null`
            : entity === 'place'
              ? this.db`p.is_active and p.location is not null`
              : this.db`b.status = 'approved' and b.location is not null`
        }
        ${
          opts.categorySlug
            ? this.db`and exists (select 1 from public.business_categories bc join public.categories c on c.id = bc.category_id where bc.business_id = b.id and c.slug = ${opts.categorySlug})`
            : this.db``
        }
        ${opts.kind ? this.db`and b.kind = ${opts.kind}` : this.db``}
          and st_dwithin(${entity === 'place' ? this.db`p.location` : this.db`b.location`}, ${point}, ${DiscoveryService.RADII_METERS[4]})
      ) t`;
    const row = counts[0];
    const levels = [Number(row.c0), Number(row.c1), Number(row.c2), Number(row.c3)];
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] >= min) return DiscoveryService.RADII_METERS[i];
    }
    return DiscoveryService.RADII_METERS[4];
  }

  /**
   * Home discovery payload: one spatial query per entity within 100 km,
   * grouped per category in memory — each category independently picks the
   * smallest radius that satisfies its own minimum.
   */
  async home(lat: number, lng: number, perCategoryLimit = 8) {
    const point = this.db`st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`;
    const maxR = DiscoveryService.RADII_METERS[4];

    // Businesses with category slugs + city name + distance, one query.
    const businesses = (await this.db`
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
        (select c.name from public.cities c where c.id = b.city_id) as city_name,
        st_distance(b.location, ${point}) as distance_m,
        coalesce(
          (select json_agg(json_build_object('url', bi.image_url, 'public_id', bi.public_id) order by bi.is_primary desc, bi.sort_order)
           from public.business_images bi where bi.business_id = b.id), '[]') as images,
        coalesce(
          (select json_agg(ha.amenity) from public.hotel_amenities ha
           join public.hotels hh on hh.id = ha.hotel_id where hh.business_id = b.id), '[]') as amenities,
        coalesce(
          (select json_agg(c.slug) from public.business_categories bc
           join public.categories c on c.id = bc.category_id where bc.business_id = b.id), '[]') as category_slugs
      from public.businesses b
      left join public.doctors d on d.business_id = b.id
      left join public.hotels h on h.business_id = b.id
      left join public.restaurants r on r.business_id = b.id
      where b.status = 'approved'
        and b.location is not null
        and st_dwithin(b.location, ${point}, ${maxR})
      order by b.location <-> ${point}
    `) as Record<string, unknown>[];

    // Group by category slug; per category apply independent radius logic.
    const byCategory = new Map<string, { rows: Record<string, unknown>[] }>();
    for (const row of businesses) {
      for (const slug of (row.category_slugs as string[]) ?? []) {
        const entry = byCategory.get(slug) ?? { rows: [] };
        entry.rows.push(row);
        byCategory.set(slug, entry);
      }
    }

    const categories: Record<string, { items: unknown[]; total: number; searchRadiusKm: number }> = {};
    for (const [slug, entry] of byCategory) {
      const { min, target } = this.limitsFor(slug);
      let radius = maxR;
      let selected = entry.rows;
      for (const level of DiscoveryService.RADII_METERS) {
        const within = entry.rows.filter(
          (r) => Number(r.distance_m) <= level,
        );
        if (within.length >= min || level === maxR) {
          radius = level;
          selected = within;
          break;
        }
      }
      categories[slug] = {
        items: selected.slice(0, Math.min(target, perCategoryLimit)).map((r) => mapBusinessRow(r)),
        total: selected.length,
        searchRadiusKm: radius / 1000,
      };
    }

    // Offers near the location (own expansion).
    const offerRadius = await this.effectiveRadius(lat, lng, { entity: 'offer' });
    const offers = await this.db`
      select o.id, o.title, o.description, o.badge_text, o.subtitle, o.coupon_code,
        o.category_tag, o.valid_until, o.is_featured,
        (select image_url from public.offer_images oi where oi.offer_id = o.id order by oi.is_primary desc, oi.sort_order limit 1) as image,
        b.id as business_id, b.slug as business_slug, b.name as business_name, b.locality,
        (select c.name from public.cities c where c.id = b.city_id) as city_name,
        st_distance(b.location, ${point}) as distance_m
      from public.offers o
      join public.businesses b on b.id = o.business_id
      where o.status = 'active' and b.location is not null
        and st_dwithin(b.location, ${point}, ${offerRadius})
      order by b.location <-> ${point}
      limit 12`;

    // Places near the location (own expansion).
    const placeRadius = await this.effectiveRadius(lat, lng, { entity: 'place' });
    const places = await this.db`
      select p.id, p.slug, p.name, p.description, p.rating, p.review_count, p.timings,
        p.entry_fee, p.is_featured,
        (select c.name from public.cities c where c.id = p.city_id) as city_name,
        st_distance(p.location, ${point}) as distance_m,
        (select image_url from public.place_images pi where pi.place_id = p.id order by pi.is_primary desc, pi.sort_order limit 1) as image
      from public.places p
      where p.is_active and p.location is not null
        and st_dwithin(p.location, ${point}, ${placeRadius})
      order by p.location <-> ${point}
      limit 10`;

    return {
      location: { latitude: lat, longitude: lng },
      categories,
      offers: {
        items: offers,
        total: offers.length,
        searchRadiusKm: offerRadius / 1000,
      },
      places: {
        items: places,
        total: places.length,
        searchRadiusKm: placeRadius / 1000,
      },
    };
  }
}

/** Row → API shape (same fields as BusinessesService returns). */
function mapBusinessRow(row: Record<string, unknown>) {
  const businessRow: BusinessRow = {
    ...(row as unknown as BusinessRow),
    distance_m: row.distance_m as number | null,
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
  return toBusiness(businessRow);
}
