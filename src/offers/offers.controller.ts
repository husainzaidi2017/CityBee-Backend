import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ListOffersDto, NearbyOffersDto } from '../common/dto/query.dto';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active offers (optional tag/city filter)' })
  findMany(@Query() q: ListOffersDto) {
    return this.offers.findMany({ page: q.page, limit: q.limit, tag: q.tag, citySlug: q.city });
  }

  @Public()
  @Get('nearby')
  @ApiOperation({ summary: 'Active offers near a point (PostGIS)' })
  nearby(@Query() q: NearbyOffersDto) {
    return this.offers.nearby({ page: q.page, limit: q.limit, lat: q.lat, lng: q.lng, radius: q.radius });
  }

  @Public()
  @Get('count')
  count(@Query('city') city: string, @Query('lat') lat?: string, @Query('lng') lng?: string) {
    return this.offers.countActive(city, lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.offers.findByIdOrSlug(id);
  }
}
