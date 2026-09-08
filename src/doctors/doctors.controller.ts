import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ListBusinessesDto, NearbyBusinessesDto, SearchBusinessesDto } from '../common/dto/query.dto';
import { BusinessesService } from '../businesses/businesses.service';

/**
 * Specialized listing endpoints over the same businesses data, per the
 * spec: doctors/restaurants/hotels are business extensions, not separate
 * tables at the API surface.
 */
@ApiTags('doctors')
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List approved doctor businesses with clinic info' })
  findMany(@Query() q: ListBusinessesDto) {
    return this.businesses.findMany({ page: q.page, limit: q.limit, kind: 'doctor', citySlug: q.city });
  }

  @Public()
  @Get('nearby')
  nearby(@Query() q: NearbyBusinessesDto) {
    return this.businesses.nearby({ ...q, kind: 'doctor' });
  }

  @Public()
  @Get('search')
  search(@Query() q: SearchBusinessesDto) {
    return this.businesses.search(q.q ?? '', { page: q.page, limit: q.limit, citySlug: q.city });
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Doctor detail = business detail (clinic, address, images, phone)' })
  findOne(@Param('id') id: string) {
    return this.businesses.findByIdOrSlug(id);
  }
}
