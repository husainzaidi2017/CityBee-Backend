import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { DiscoveryService } from './discovery.service';

export class DiscoveryHomeDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;
}

/**
 * High-level nearby discovery: one call returns category-wise results where
 * EACH category independently expands its search radius until it has enough
 * results (see DiscoveryService). Flutter never implements radius logic.
 */
@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Public()
  @Get('home')
  @ApiOperation({
    summary:
      'Home feed by coordinates: per-category items with independent radius expansion',
  })
  home(@Query() dto: DiscoveryHomeDto) {
    return this.discovery.home(dto.lat, dto.lng);
  }
}
