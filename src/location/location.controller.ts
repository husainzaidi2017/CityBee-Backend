import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../auth/public.decorator';
import { LocationService } from './location.service';

export class SearchLocationDto {
  @IsString()
  @MaxLength(120)
  q: string;
}

export class ResolveLocationDto {
  @IsString()
  @MaxLength(256)
  placeId: string;
}

export class ReverseLocationDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;
}

/**
 * Dynamic location discovery backed by Google. The key stays server-side;
 * Flutter calls these endpoints only.
 *
 * NOTE: resolving a Google place NEVER creates a `cities` row — the selected
 * location is client/user state (see /users/me selected_location_* fields),
 * while `cities` remains CityBee reference data.
 */
@ApiTags('location')
@Controller('location')
export class LocationController {
  constructor(private readonly location: LocationService) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Google Places city autocomplete (guests allowed)' })
  search(@Query() dto: SearchLocationDto) {
    return this.location.search(dto.q);
  }

  @Public()
  @Get('resolve')
  @ApiOperation({ summary: 'Resolve a place_id to name/coordinates/address (no city is created)' })
  async resolve(@Query() dto: ResolveLocationDto) {
    const resolved = await this.location.resolve(dto.placeId);
    if (!resolved.displayName) {
      throw new BadRequestException('Could not resolve that location.');
    }
    return resolved;
  }

  @Public()
  @Get('reverse')
  @ApiOperation({ summary: 'Reverse geocode GPS coordinates to a location (no city is created)' })
  reverse(@Query() dto: ReverseLocationDto) {
    return this.location.reverse(dto.lat, dto.lng);
  }
}
