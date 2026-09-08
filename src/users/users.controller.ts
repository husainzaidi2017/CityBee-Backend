import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth-user.decorator';
import { UsersService } from './users.service';

export class SelectedLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsOptional()
  @IsUUID()
  selectedCityId?: string;

  @IsOptional()
  selectedLocation?: SelectedLocationDto;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user profile + selected location (creates the mirror row on first call)' })
  me(@CurrentUser() user: AuthUser) {
    return this.users.ensureAndMe(user);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user, dto);
  }
}
