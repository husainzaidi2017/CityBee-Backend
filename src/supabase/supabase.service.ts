import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Verifies Supabase Auth JWTs and mirrors profile rows in public.users.
 *
 * Verification calls Supabase's /auth/v1/user endpoint with the caller's
 * token — Supabase validates the signature server-side, so the API never
 * needs key material beyond the public anon key. Results are cached briefly
 * to keep hot paths cheap.
 */
@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly cache = new Map<string, { user: SupabaseUser; expires: number }>();
  private readonly ttlMs = 60_000;

  constructor(private readonly config: ConfigService) {}

  async verifyToken(token: string): Promise<SupabaseUser> {
    const cached = this.cache.get(token);
    if (cached && cached.expires > Date.now()) return cached.user;

    const url = this.config.get<string>('supabaseUrl') ?? '';
    const anonKey = this.config.get<string>('supabaseAnonKey') ?? '';

    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      this.logger.debug(`Token verification failed: ${res.status}`);
      throw new UnauthorizedException('Invalid or expired session');
    }

    const raw = (await res.json()) as {
      id: string;
      email?: string;
      phone?: string;
      user_metadata?: { name?: string; avatar_url?: string };
    };

    const user: SupabaseUser = {
      id: raw.id,
      email: raw.email,
      phone: raw.phone,
      name: raw.user_metadata?.name,
      avatarUrl: raw.user_metadata?.avatar_url,
    };

    this.cache.set(token, { user, expires: Date.now() + this.ttlMs });
    if (this.cache.size > 500) this.cache.clear(); // crude bound
    return user;
  }
}
