import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CURRENT_USER } from './supabase-auth.guard';
import { SupabaseUser } from '../supabase/supabase.service';

export type AuthUser = SupabaseUser;

/** Returns the verified Supabase user, or throws on anonymous requests. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const user = ctx.switchToHttp().getRequest()[CURRENT_USER];
    if (!user) throw new UnauthorizedException('Sign in required');
    return user;
  },
);
