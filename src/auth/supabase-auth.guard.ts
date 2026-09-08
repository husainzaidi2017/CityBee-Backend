import { CanActivate, ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthUser } from './auth-user.decorator';

export const CURRENT_USER = 'citybeeCurrentUser';

/**
 * Verifies the Supabase JWT in `Authorization: Bearer <token>`.
 *
 * Routes decorated with @Public() skip verification (guest browsing).
 * On success the verified user is attached to the request for the
 * @CurrentUser() param decorator and ownership checks.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    @Optional() private readonly reflector: Reflector = new Reflector(),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();

    const header: string | undefined = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic) return true; // guest access
      throw new UnauthorizedException('Sign in required');
    }

    try {
      request[CURRENT_USER] = await this.supabase.verifyToken(token);
      return true;
    } catch (err) {
      if (isPublic) return true; // public routes tolerate bad tokens
      throw err;
    }
  }
}

export type { AuthUser };
