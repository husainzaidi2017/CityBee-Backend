import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';

@Injectable()
export class CitiesService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  /** Cities CityBee has content for (cached from Google Places selections). */
  async findMany() {
    const rows = await this.db`
      select c.slug, c.name, c.state_region, c.nickname, c.default_area, c.latitude, c.longitude,
        (select count(*)::int from public.businesses b where b.city_id = c.id and b.status = 'approved') as business_count
      from public.cities c
      where c.is_active
      order by business_count desc, c.name`;
    return rows;
  }

  async findOne(idOrSlug: string) {
    const rows = await this.db`
      select slug, name, state_region, country, country_code, latitude, longitude, google_place_id
      from public.cities where slug = ${idOrSlug} limit 1`;
    if (!rows.length) throw new NotFoundException('City not found');
    return rows[0];
  }

  /**
   * Cache-or-create a city from a Google Places selection. Called when a user
   * picks a location; CityBee never maintains a master world-city list.
   */
  async upsertFromPlaces(input: {
    name: string;
    stateRegion?: string;
    country?: string;
    countryCode?: string;
    latitude: number;
    longitude: number;
    googlePlaceId?: string;
  }) {
    const slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const rows = await this.db`
      insert into public.cities (slug, name, state_region, country, country_code, latitude, longitude, google_place_id)
      values (${slug}, ${input.name}, ${input.stateRegion ?? null}, ${input.country ?? ''}, ${input.countryCode ?? null}, ${input.latitude}, ${input.longitude}, ${input.googlePlaceId ?? null})
      on conflict (slug) do update set
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        google_place_id = coalesce(excluded.google_place_id, public.cities.google_place_id),
        updated_at = now()
      returning slug, name, state_region, latitude, longitude`;
    return rows[0];
  }
}
