import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from './pagination.dto';

/** Query DTOs shared by list endpoints. One class per endpoint because the
 *  global forbidNonWhitelisted pipe rejects any undeclared param. */

export class ListBusinessesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ enum: ['restaurant', 'doctor', 'hotel', 'salon', 'shop', 'mall', 'service'] })
  @IsOptional()
  @IsString()
  kind?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  featured?: string;

  /** Optional reference point to compute distanceKm (e.g. selected city). */
  @ApiPropertyOptional({ example: 28.8386 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 78.7733 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

export class NearbyBusinessesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 28.8386 })
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @ApiPropertyOptional({ example: 78.7733 })
  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 5000, description: 'Radius in meters' })
  @Type(() => Number)
  @IsNumber()
  radius: number = 5000;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kind?: string;
}

export class SearchBusinessesDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'biryani' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;
}

export class ListOffersDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'Dining' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;
}

export class NearbyOffersDto extends PaginationDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  radius: number = 5000;
}

export class ListPlacesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  featured?: string;
}

export class NearbyPlacesDto extends PaginationDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: 10000 })
  @Type(() => Number)
  @IsNumber()
  radius: number = 10000;
}

export class SearchDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
