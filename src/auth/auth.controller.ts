import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth-user.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get('me')
  @ApiOperation({ summary: 'Verify the Supabase token and return the auth user' })
  async me(@CurrentUser() user: AuthUser) {
    // The guard already verified the token; echo identity for the client.
    return { id: user.id, email: user.email, phone: user.phone, name: user.name, avatarUrl: user.avatarUrl };
  }
}
