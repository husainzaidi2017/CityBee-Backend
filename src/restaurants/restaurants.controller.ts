import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ListBusinessesDto, NearbyBusinessesDto } from '../common/dto/query.dto';
import { BusinessesService } from '../businesses/businesses.service';

@ApiTags('restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public()
  @Get()
  findMany(@Query() q: ListBusinessesDto) {
    return this.businesses.findMany({ page: q.page, limit: q.limit, kind: 'restaurant', citySlug: q.city });
  }

  @Public()
  @Get('nearby')
  nearby(@Query() q: NearbyBusinessesDto) {
    return this.businesses.nearby({ ...q, kind: 'restaurant' });
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businesses.findByIdOrSlug(id);
  }
}
