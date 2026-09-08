import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ListBusinessesDto, NearbyBusinessesDto } from '../common/dto/query.dto';
import { BusinessesService } from '../businesses/businesses.service';

@ApiTags('hotels')
@Controller('hotels')
export class HotelsController {
  constructor(private readonly businesses: BusinessesService) {}

  @Public()
  @Get()
  findMany(@Query() q: ListBusinessesDto) {
    return this.businesses.findMany({ page: q.page, limit: q.limit, kind: 'hotel', citySlug: q.city });
  }

  @Public()
  @Get('nearby')
  nearby(@Query() q: NearbyBusinessesDto) {
    return this.businesses.nearby({ ...q, kind: 'hotel' });
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businesses.findByIdOrSlug(id);
  }
}
