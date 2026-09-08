import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { CitiesService } from './cities.service';

export class CityFromPlacesDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  stateRegion?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  googlePlaceId?: string;
}

@ApiTags('cities')
@Controller('cities')
export class CitiesController {
  constructor(private readonly cities: CitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Cities with CityBee content' })
  findMany() {
    return this.cities.findMany();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cities.findOne(id);
  }

  @Post('from-places')
  @ApiOperation({ summary: 'Cache a city chosen via Google Places (idempotent by slug)' })
  upsertFromPlaces(@Body() dto: CityFromPlacesDto) {
    return this.cities.upsertFromPlaces(dto);
  }
}
