import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../auth/auth-user.decorator';
import { ListingsService } from './listings.service';
import { RejectSubmissionDto, SubmitListingDto } from './dto';

/**
 * List-Your-Business flow. The /me routes serve the Flutter submission
 * wizard; the /admin routes implement the approve/reject lifecycle the
 * CityBee Admin panel calls (it already prefers these over direct
 * Supabase writes).
 */
@ApiTags('listings')
@ApiBearerAuth()
@Controller()
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  // ── owner routes ─────────────────────────────────────────────────────

  @Post('me/business-listings')
  @ApiOperation({
    summary:
      'Submit a business listing for admin review (owner derived from JWT; status pending)',
  })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitListingDto) {
    return this.listings.submit(user, dto);
  }

  @Get('me/business-listings')
  @ApiOperation({ summary: 'My listing submissions (all statuses)' })
  mine(@CurrentUser() user: AuthUser) {
    return this.listings.mySubmissions(user);
  }

  @Get('me/business-listings/:id')
  @ApiOperation({ summary: 'Full detail of one own submission (edit prefill)' })
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.mySubmissionDetail(user, id);
  }

  @Patch('me/business-listings/:id')
  @ApiOperation({ summary: 'Edit a rejected own submission before resubmitting' })
  edit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitListingDto,
  ) {
    return this.listings.editSubmission(user, id, dto);
  }

  @Post('me/business-listings/:id/resubmit')
  @ApiOperation({ summary: 'Resubmit a rejected listing (back to pending)' })
  resubmit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.resubmit(user, id);
  }

  // ── admin routes (role-guarded in the service) ───────────────────────

  @Post('admin/submissions/:id/approve')
  @ApiOperation({
    summary:
      'Approve a submission → creates the live business with owner_id = submitter, notifies the owner',
  })
  approve(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.approve(user, id);
  }

  @Post('admin/submissions/:id/reject')
  @ApiOperation({ summary: 'Reject a submission with a reason (notifies the owner)' })
  reject(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectSubmissionDto,
  ) {
    return this.listings.reject(user, id, dto.note);
  }
}
