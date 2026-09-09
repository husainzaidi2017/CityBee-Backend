import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CURRENT_USER } from '../auth/supabase-auth.guard';
import { DATABASE } from '../database/database.module';
import type { Sql } from 'postgres';

/**
 * Role guard: allows only users with role = 'admin' in public.users.
 * Runs after the global SupabaseAuthGuard verified the JWT.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request[CURRENT_USER] as { id?: string } | undefined;
    if (!user?.id) throw new ForbiddenException('Sign in required');

    const rows = await this.db`
      select 1 from public.users where id = ${user.id}::uuid and role = 'admin'
    `;
    if (!rows.length) throw new ForbiddenException('Admin access required');
    return true;
  }
}
