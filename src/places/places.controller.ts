import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ListPlacesDto, NearbyPlacesDto, SearchDto } from '../common/dto/query.dto';
import { PlacesService } from './places.service';

@ApiTags('places')
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Public()
  @Get()
  findMany(@Query() q: ListPlacesDto) {
    return this.places.findMany({ page: q.page, limit: q.limit, citySlug: q.city, featured: q.featured === 'true' });
  }

  @Public()
  @Get('nearby')
  nearby(@Query() q: NearbyPlacesDto) {
    return this.places.nearby({ page: q.page, limit: q.limit, lat: q.lat, lng: q.lng, radius: q.radius });
  }

  @Public()
  @Get('search')
  search(@Query() q: SearchDto) {
    return this.places.search(q.q ?? '', { page: q.page, limit: q.limit });
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.places.findOne(id);
  }
}
