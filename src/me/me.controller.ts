import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../auth/auth-user.decorator';
import { MeService } from './me.service';
import {
  BusinessHourDto,
  CreateBusinessServiceDto,
  CreateMenuItemDto,
  CreateMenuCategoryDto,
  CreateOfferDto,
  UpdateAmenitiesDto,
  UpdateBusinessDto,
  UpdateBusinessServiceDto,
  UpdateDoctorDto,
  UpdateHotelDto,
  UpdateHoursDto,
  UpdateMenuItemDto,
  UpdateMenuCategoryDto,
  UpdateOfferDto,
  UpdateRestaurantDto,
} from './dto';

/**
 * Business-owner management API. Every route derives the user from the
 * verified Supabase JWT and verifies business ownership server-side —
 * owner ids from the client are never trusted.
 */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  // ── summary + list (declared BEFORE :businessId routes) ───────────────

  @Get('businesses/summary')
  @ApiOperation({ summary: 'Lightweight owner status for app startup / bottom navigation' })
  summary(@CurrentUser() user: AuthUser) {
    return this.me.summary(user);
  }

  @Get('businesses')
  @ApiOperation({ summary: 'All businesses owned by the authenticated user' })
  listBusinesses(@CurrentUser() user: AuthUser) {
    return this.me.listBusinesses(user);
  }

  // ── one business ──────────────────────────────────────────────────────

  @Get('businesses/:businessId')
  @ApiOperation({ summary: 'Full management details for an owned business' })
  details(@CurrentUser() user: AuthUser, @Param('businessId') businessId: string) {
    return this.me.businessDetails(user, businessId);
  }

  @Patch('businesses/:businessId')
  @ApiOperation({ summary: 'Update allowed common business fields (owner/admin only)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.me.updateBusiness(user, businessId, dto);
  }

  @Post('businesses/:businessId/change-request')
  @ApiOperation({ summary: 'Submit common business edits for admin approval' })
  changeRequest(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.me.requestBusinessUpdate(user, businessId, dto);
  }

  // ── hours ─────────────────────────────────────────────────────────────

  @Get('businesses/:businessId/hours')
  hours(@CurrentUser() user: AuthUser, @Param('businessId') businessId: string) {
    return this.me.getHours(user, businessId);
  }

  @Put('businesses/:businessId/hours')
  updateHours(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateHoursDto,
  ) {
    return this.me.updateHours(user, businessId, dto);
  }

  // ── offers ────────────────────────────────────────────────────────────

  @Get('businesses/:businessId/offers')
  listOffers(@CurrentUser() user: AuthUser, @Param('businessId') businessId: string) {
    return this.me.listOffers(user, businessId);
  }

  @Post('businesses/:businessId/offers')
  createOffer(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.me.createOffer(user, businessId, dto);
  }

  @Patch('businesses/:businessId/offers/:offerId')
  updateOffer(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('offerId') offerId: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.me.updateOffer(user, businessId, offerId, dto);
  }

  @Delete('businesses/:businessId/offers/:offerId')
  deleteOffer(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('offerId') offerId: string,
  ) {
    return this.me.deleteOffer(user, businessId, offerId);
  }

  // ── menu (restaurant) ─────────────────────────────────────────────────

  @Get('businesses/:businessId/menu')
  menu(@CurrentUser() user: AuthUser, @Param('businessId') businessId: string) {
    return this.me.listMenu(user, businessId);
  }

  @Post('businesses/:businessId/menu/categories')
  createMenuCategory(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateMenuCategoryDto,
  ) {
    return this.me.createMenuCategory(user, businessId, dto);
  }

  @Patch('businesses/:businessId/menu/categories/:categoryId')
  updateMenuCategory(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.me.updateMenuCategory(user, businessId, categoryId, dto);
  }

  @Delete('businesses/:businessId/menu/categories/:categoryId')
  deleteMenuCategory(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    return this.me.deleteMenuCategory(user, businessId, categoryId);
  }

  @Post('businesses/:businessId/menu/items')
  createMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.me.createMenuItem(user, businessId, dto);
  }

  @Patch('businesses/:businessId/menu/items/:itemId')
  updateMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.me.updateMenuItem(user, businessId, itemId, dto);
  }

  @Delete('businesses/:businessId/menu/items/:itemId')
  deleteMenuItem(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.me.deleteMenuItem(user, businessId, itemId);
  }

  // ── business services (salon/barber/repair…) ──────────────────────────

  @Get('businesses/:businessId/services')
  listServices(@CurrentUser() user: AuthUser, @Param('businessId') businessId: string) {
    return this.me.listBusinessServices(user, businessId);
  }

  @Post('businesses/:businessId/services')
  createService(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: CreateBusinessServiceDto,
  ) {
    return this.me.createBusinessService(user, businessId, dto);
  }

  @Patch('businesses/:businessId/services/:serviceId')
  updateService(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpdateBusinessServiceDto,
  ) {
    return this.me.updateBusinessService(user, businessId, serviceId, dto);
  }

  @Delete('businesses/:businessId/services/:serviceId')
  deleteService(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.me.deleteBusinessService(user, businessId, serviceId);
  }

  // ── type-specific details ─────────────────────────────────────────────

  @Patch('businesses/:businessId/doctor')
  updateDoctor(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateDoctorDto,
  ) {
    return this.me.updateDoctor(user, businessId, dto);
  }

  @Patch('businesses/:businessId/restaurant')
  updateRestaurant(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.me.updateRestaurant(user, businessId, dto);
  }

  @Patch('businesses/:businessId/hotel')
  updateHotel(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateHotelDto,
  ) {
    return this.me.updateHotel(user, businessId, dto);
  }

  @Put('businesses/:businessId/hotel/amenities')
  updateAmenities(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Body() dto: UpdateAmenitiesDto,
  ) {
    return this.me.updateAmenities(user, businessId, dto);
  }

  // ── images ────────────────────────────────────────────────────────────

  @Patch('businesses/:businessId/images/:imageId/primary')
  setImagePrimary(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.me.setImagePrimary(user, businessId, imageId);
  }

  // ── reviews (read-only) ───────────────────────────────────────────────

  @Get('businesses/:businessId/reviews')
  reviews(
    @CurrentUser() user: AuthUser,
    @Param('businessId') businessId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.me.listReviews(
      user,
      businessId,
      Math.min(Number.parseInt(limit ?? '50', 10) || 50, 100),
      Math.max(Number.parseInt(offset ?? '0', 10) || 0, 0),
    );
  }
}

// Re-export for the module (keeps DTO imports close to their use).
export { BusinessHourDto };
