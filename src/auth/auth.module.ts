import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [
    // Global: every route requires a valid token unless marked @Public().
    { provide: APP_GUARD, useClass: SupabaseAuthGuard },
  ],
})
export class AuthModule {}
