import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CurrentUser, AuthUser } from '../auth/auth-user.decorator';
import { Public } from '../auth/public.decorator';
import { ReviewsService } from './reviews.service';

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  text?: string;
}

@ApiTags('reviews')
@Controller('businesses/:businessId/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Approved reviews for a business' })
  list(@Param('businessId') businessId: string) {
    return this.reviews.listForBusiness(businessId);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Write a review (one per user per business)' })
  create(@CurrentUser() user: AuthUser, @Param('businessId') businessId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.id, businessId, dto);
  }
}
