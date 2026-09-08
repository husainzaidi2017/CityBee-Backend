import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ListBusinessesDto, NearbyBusinessesDto, SearchBusinessesDto } from '../common/dto/query.dto';
import { BusinessesService } from './businesses.service';

@ApiTags('businesses')
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List approved businesses (filter by category/city/kind)' })
  findMany(@Query() q: ListBusinessesDto) {
    return this.businesses.findMany({
      page: q.page,
      limit: q.limit,
      categorySlug: q.category,
      citySlug: q.city,
      kind: q.kind,
      featured: q.featured == null ? undefined : q.featured === 'true',
      lat: q.lat,
      lng: q.lng,
    });
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Businesses within a radius (PostGIS ST_DWithin), sorted by distance' })
  nearby(@Query() q: NearbyBusinessesDto) {
    return this.businesses.nearby({
      page: q.page,
      limit: q.limit,
      lat: q.lat,
      lng: q.lng,
      radius: q.radius,
      categorySlug: q.category,
      kind: q.kind,
    });
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search by name, tagline, locality, specialization, cuisine' })
  search(@Query() q: SearchBusinessesDto) {
    return this.businesses.search(q.q ?? '', { page: q.page, limit: q.limit, citySlug: q.city });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Business detail by UUID or slug (with menu, reviews, extensions)' })
  findOne(@Param('id') id: string) {
    return this.businesses.findByIdOrSlug(id);
  }
}
