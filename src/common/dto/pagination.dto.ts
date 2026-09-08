import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; hasNext: boolean };
}

export function paginate<T>(rows: T[], total: number, page: number, limit: number): Paginated<T> {
  return {
    data: rows,
    pagination: { page, limit, total, hasNext: page * limit < total },
  };
}
