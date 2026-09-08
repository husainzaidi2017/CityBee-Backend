import { Inject, Injectable } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { AuthUser } from '../auth/auth-user.decorator';

/**
 * Own-profile access. The public.users row is created on first authenticated
 * request (id = Supabase auth uid, so no credentials are duplicated).
 */
@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  async ensureAndMe(user: AuthUser) {
    const rows = await this.db`
      insert into public.users (id, name, phone, email, profile_image_url)
      values (${user.id}::uuid, ${user.name ?? ''}, ${user.phone ?? null}, ${user.email ?? null}, ${user.avatarUrl ?? null})
      on conflict (id) do update set updated_at = now()
      returning id, name, phone, email, profile_image_url as "profileImageUrl", role, selected_city_id as "selectedCityId"`;
    const stats = await this.stats(user.id);
    return { ...rows[0], bookmarkCount: stats.favorites, reviewsGiven: stats.reviews };
  }

  async updateProfile(user: AuthUser, patch: { name?: string; phone?: string; profileImageUrl?: string; selectedCityId?: string }) {
    const rows = await this.db`
      insert into public.users (id, name, phone, email, profile_image_url)
      values (${user.id}::uuid, ${patch.name ?? user.name ?? ''}, ${patch.phone ?? user.phone ?? null}, ${user.email ?? null}, ${patch.profileImageUrl ?? user.avatarUrl ?? null})
      on conflict (id) do update set
        name = coalesce(${patch.name ?? null}, public.users.name),
        phone = coalesce(${patch.phone ?? null}, public.users.phone),
        profile_image_url = coalesce(${patch.profileImageUrl ?? null}, public.users.profile_image_url),
        selected_city_id = coalesce(${patch.selectedCityId ? this.db`${patch.selectedCityId}::uuid` : this.db`null`}::uuid, public.users.selected_city_id),
        updated_at = now()
      returning id, name, phone, email, profile_image_url as "profileImageUrl", role, selected_city_id as "selectedCityId"`;
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
