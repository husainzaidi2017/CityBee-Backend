import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ServicesService } from './services.service';

@ApiTags('services')
@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary:
      'Home-service experts for a city (electrician, plumber, carpenter, …). Resolves the city from lat/lng, else city slug/name, else Moradabad.',
  })
  findMany(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('city') city?: string,
  ) {
    const latitude = lat != null ? Number.parseFloat(lat) : undefined;
    const longitude = lng != null ? Number.parseFloat(lng) : undefined;
    const validLat =
      latitude != null && Number.isFinite(latitude) ? latitude : undefined;
    const validLng =
      longitude != null && Number.isFinite(longitude) ? longitude : undefined;
    return this.services.findForLocation(validLat, validLng, city);
  }
}
