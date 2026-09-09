import { Inject, Injectable } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { AuthUser } from '../auth/auth-user.decorator';

export interface SelectedLocationInput {
  name?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  locality?: string;
}

/**
 * Own-profile access. The public.users row is created on first authenticated
 * request (id = Supabase auth uid, so no credentials are duplicated).
 *
 * The user's selected Google location is stored here (selected_location_*)
 * — selecting a location never creates a `cities` row.
 */
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  private selectedLocationColumns() {
    return this.db`
      selected_location_name as "selectedLocationName",
      selected_location_lat as "selectedLocationLat",
      selected_location_lng as "selectedLocationLng",
      selected_location_google_place_id as "selectedLocationGooglePlaceId",
      selected_location_country as "selectedLocationCountry",
      selected_location_country_code as "selectedLocationCountryCode",
      selected_location_state as "selectedLocationState",
      selected_location_locality as "selectedLocationLocality"
    `;
  }

  async ensureAndMe(user: AuthUser) {
    // First-login sync: fill ONLY missing profile fields from the auth user
    // (Google/email metadata). A user's manual profile edits are never
    // overwritten on later logins — the conflict update only touches
    // updated_at, and the insert below only runs for NEW rows.
    const rows = await this.db`
      insert into public.users (id, name, phone, email, profile_image_url)
      values (${user.id}::uuid, ${user.name ?? ''}, ${user.phone ?? null}, ${user.email ?? null}, ${user.avatarUrl ?? null})
      on conflict (id) do update set
        -- backfill blank fields only (first Google login arriving after a
        -- partial row): never clobber user-edited values.
        name = case when public.users.name = '' then coalesce(excluded.name, public.users.name) else public.users.name end,
        email = coalesce(public.users.email, excluded.email),
        profile_image_url = coalesce(public.users.profile_image_url, excluded.profile_image_url),
        updated_at = now()
      returning id, name, phone, email, profile_image_url as "profileImageUrl", role, selected_city_id as "selectedCityId",
        ${this.selectedLocationColumns()}`;
    const stats = await this.stats(user.id);
    return { ...rows[0], bookmarkCount: stats.favorites, reviewsGiven: stats.reviews };
  }

  async updateProfile(user: AuthUser, patch: { name?: string; phone?: string; profileImageUrl?: string; selectedLocation?: SelectedLocationInput }) {
    const loc = patch.selectedLocation;
    const rows = await this.db`
      insert into public.users (id, name, phone, email, profile_image_url)
      values (${user.id}::uuid, ${patch.name ?? user.name ?? ''}, ${patch.phone ?? user.phone ?? null}, ${user.email ?? null}, ${patch.profileImageUrl ?? user.avatarUrl ?? null})
      on conflict (id) do update set
        name = coalesce(${patch.name ?? null}, public.users.name),
        phone = coalesce(${patch.phone ?? null}, public.users.phone),
        profile_image_url = coalesce(${patch.profileImageUrl ?? null}, public.users.profile_image_url),
        selected_location_name = coalesce(${loc?.name ?? null}, public.users.selected_location_name),
        selected_location_lat = coalesce(${loc?.latitude ?? null}, public.users.selected_location_lat),
        selected_location_lng = coalesce(${loc?.longitude ?? null}, public.users.selected_location_lng),
        selected_location_google_place_id = coalesce(${loc?.googlePlaceId ?? null}, public.users.selected_location_google_place_id),
        selected_location_country = coalesce(${loc?.country ?? null}, public.users.selected_location_country),
        selected_location_country_code = coalesce(${loc?.countryCode ?? null}, public.users.selected_location_country_code),
        selected_location_state = coalesce(${loc?.state ?? null}, public.users.selected_location_state),
        selected_location_locality = coalesce(${loc?.locality ?? null}, public.users.selected_location_locality),
        updated_at = now()
      returning id, name, phone, email, profile_image_url as "profileImageUrl", role, selected_city_id as "selectedCityId",
        ${this.selectedLocationColumns()}`;
    return rows[0];
  }

  async stats(userId: string) {
    const rows = await this.db`
      select
        (select count(*)::int from public.favorites where user_id = ${userId}::uuid) as favorites,
        (select count(*)::int from public.reviews where user_id = ${userId}::uuid) as reviews`;
    return rows[0];
  }
}
