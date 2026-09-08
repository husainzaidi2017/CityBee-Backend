import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { LocationService } from './location.service';
import { CitiesService } from '../cities/cities.service';

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

/**
 * Dynamic location discovery backed by Google Places. The key stays
 * server-side; Flutter calls these endpoints only.
 */
@ApiTags('location')
@Controller('location')
export class LocationController {
  constructor(
    private readonly location: LocationService,
    private readonly cities: CitiesService,
  ) {}

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Google Places city autocomplete (guests allowed)' })
  search(@Query() dto: SearchLocationDto) {
    return this.location.search(dto.q);
  }

  @Public()
  @Get('resolve')
  @ApiOperation({
    summary: 'Resolve a place_id to coordinates and cache it as a CityBee city (idempotent)',
  })
  async resolve(@Query() dto: ResolveLocationDto) {
    const resolved = await this.location.resolve(dto.placeId);
    if (!resolved.name) {
      throw new BadRequestException('Could not resolve that location.');
    }
    const city = await this.cities.upsertFromPlaces({
      name: resolved.name,
      stateRegion: resolved.stateRegion,
      country: resolved.country,
      countryCode: resolved.countryCode,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      googlePlaceId: resolved.placeId,
    });
    // Same shape as GET /cities rows so the Flutter City mapper works as-is.
    return {
      id: city.slug,
      slug: city.slug,
      name: city.name,
      state_region: city.state_region,
      nickname: '',
      default_area: resolved.name,
      latitude: city.latitude,
      longitude: city.longitude,
      google_place_id: resolved.placeId,
    };
  }
}
