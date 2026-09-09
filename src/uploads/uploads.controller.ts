import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Sql } from 'postgres';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DATABASE } from '../database/database.module';
import { CurrentUser, AuthUser } from '../auth/auth-user.decorator';
import { UploadsService } from './uploads.service';

export class AssociateImageDto {
  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsUUID()
  entityId: string;

  @IsIn(['business', 'offer', 'place'])
  entityType: 'business' | 'offer' | 'place';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ReplaceImageDto {
  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  altText?: string;
}

const MAX_IMAGES_PER_BUSINESS = 5;

const folderFor: Record<string, (id: string) => string> = {
  business: (id) => `citybee/businesses/${id}`,
  offer: (id) => `citybee/offers/${id}`,
  place: (id) => `citybee/places/${id}`,
};

/**
 * Two-step upload: POST /uploads/image stores the file on Cloudinary and
 * returns { secureUrl, publicId }; POST /uploads/associate links it to the
 * entity row (business_images / offer_images / place_images). Clients can
 * retry the associate step without re-uploading.
 *
 * Delete/replace flows remove the Cloudinary asset via the backend — the
 * client never touches Cloudinary credentials.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    @Inject(DATABASE) private readonly db: Sql,
  ) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload one optimized image to Cloudinary (returns secureUrl + publicId)' })
  async uploadImage(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
    @Body('entityType') entityType?: string,
    @Body('entityId') entityId?: string,
  ) {
    if (!file) throw new BadRequestException('Attach an image in the "file" field');
    if (entityType && entityId && folderFor[entityType]) {
      return this.uploads.uploadImage(file, folderFor[entityType](entityId));
    }
    return this.uploads.uploadImage(file, 'citybee/unsorted');
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('files', 8))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload up to 8 optimized images to Cloudinary' })
  async uploadImages(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('Attach images in the "files" field');
    return this.uploads.uploadImages(files, 'citybee/unsorted');
  }

  @Post('associate')
  @ApiOperation({ summary: 'Link an uploaded Cloudinary image to an entity (owner/admin only, max 5/business)' })
  async associate(@CurrentUser() user: AuthUser, @Body() dto: AssociateImageDto) {
    if (dto.entityType === 'business') {
      const owns = await this.db`
        select 1 from public.businesses where id = ${dto.entityId}::uuid
          and (owner_id = ${user.id}::uuid
               or exists (select 1 from public.users u where u.id = ${user.id}::uuid and u.role = 'admin'))`;
      if (!owns.length) throw new BadRequestException('You can only manage images of your own business');

      // Limit check BEFORE insert (the DB trigger is the hard backstop).
      const count = await this.db`
        select count(*)::int as n from public.business_images where business_id = ${dto.entityId}::uuid`;
      if (count[0].n >= MAX_IMAGES_PER_BUSINESS) {
        throw new BadRequestException('BUSINESS_IMAGE_LIMIT_REACHED');
      }

      try {
        const rows = await this.db`
          insert into public.business_images (business_id, image_url, public_id, alt_text, sort_order, is_primary)
          values (${dto.entityId}::uuid, ${dto.imageUrl}, ${dto.publicId ?? null}, ${dto.altText ?? null},
                  (select coalesce(max(sort_order), -1) + 1 from public.business_images where business_id = ${dto.entityId}::uuid),
                  ${dto.isPrimary ?? false})
          returning id, sort_order, is_primary`;
        return { imageId: rows[0].id, entityType: 'business', entityId: dto.entityId, sortOrder: rows[0].sort_order };
      } catch (err) {
        // Orphan cleanup: if the DB rejected the row, remove the uploaded
        // Cloudinary asset so storage and the database stay consistent.
        if (dto.publicId) await this.uploads.deleteImage(dto.publicId);
        const message = err instanceof Error ? err.message : '';
        if (message.includes('BUSINESS_IMAGE_LIMIT_REACHED')) {
          throw new BadRequestException('BUSINESS_IMAGE_LIMIT_REACHED');
        }
        if (message.includes('business_images_one_primary')) {
          throw new BadRequestException('This business already has a primary image.');
        }
        if (message.includes('business_images_public_id_uidx')) {
          throw new BadRequestException('That image is already linked to this business.');
        }
        throw new BadRequestException('Could not save the image. Please try again.');
      }
    }

    if (dto.entityType === 'offer') {
      const owns = await this.db`
        select 1 from public.offers o join public.businesses b on b.id = o.business_id
          where o.id = ${dto.entityId}::uuid
            and (b.owner_id = ${user.id}::uuid
                 or exists (select 1 from public.users u where u.id = ${user.id}::uuid and u.role = 'admin'))`;
      if (!owns.length) throw new BadRequestException('You can only manage images of your own offers');
      const rows = await this.db`
        insert into public.offer_images (offer_id, image_url, public_id, sort_order, is_primary)
        values (${dto.entityId}::uuid, ${dto.imageUrl}, ${dto.publicId ?? null}, 0, false)
        returning id`;
      return { imageId: rows[0].id, entityType: 'offer', entityId: dto.entityId };
    }

    const isAdmin = await this.db`
      select 1 from public.users where id = ${user.id}::uuid and role = 'admin'`;
    if (!isAdmin.length) throw new BadRequestException('Only admins manage place images');
    const rows = await this.db`
      insert into public.place_images (place_id, image_url, public_id, sort_order, is_primary)
      values (${dto.entityId}::uuid, ${dto.imageUrl}, ${dto.publicId ?? null}, 0, false)
      returning id`;
    return { imageId: rows[0].id, entityType: 'place', entityId: dto.entityId };
  }

  @Delete('business-images/:imageId')
  @ApiOperation({ summary: 'Delete a business image: removes the Cloudinary asset AND the mapping row' })
  async deleteBusinessImage(
    @CurrentUser() user: AuthUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    const rows = await this.db`
      select bi.id, bi.public_id, bi.business_id, b.owner_id
      from public.business_images bi join public.businesses b on b.id = bi.business_id
      where bi.id = ${imageId}::uuid`;
    if (!rows.length) throw new BadRequestException('Image not found');
    const row = rows[0];
    const isAdmin = await this.db`
      select 1 from public.users where id = ${user.id}::uuid and role = 'admin'`;
    if (row.owner_id !== user.id && !isAdmin.length) {
      throw new BadRequestException('You can only manage images of your own business');
    }

    // 1. Cloudinary asset first (a missing asset must not block row removal).
    if (row.public_id) await this.uploads.deleteImage(row.public_id);
    // 2. Then the mapping row.
    await this.db`delete from public.business_images where id = ${imageId}::uuid`;
    return { deleted: true, imageId };
  }

  @Put('business-images/:imageId')
  @ApiOperation({
    summary: 'Replace a business image: deletes the old Cloudinary asset, links the new one, keeps order/primary/alt',
  })
  async replaceBusinessImage(
    @CurrentUser() user: AuthUser,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: ReplaceImageDto,
  ) {
    const rows = await this.db`
      select bi.id, bi.public_id, bi.business_id, b.owner_id
      from public.business_images bi join public.businesses b on b.id = bi.business_id
      where bi.id = ${imageId}::uuid`;
    if (!rows.length) throw new BadRequestException('Image not found');
    const row = rows[0];
    const isAdmin = await this.db`
      select 1 from public.users where id = ${user.id}::uuid and role = 'admin'`;
    if (row.owner_id !== user.id && !isAdmin.length) {
      throw new BadRequestException('You can only manage images of your own business');
    }

    const updated = await this.db`
      update public.business_images set
        image_url = ${dto.imageUrl},
        public_id = ${dto.publicId ?? null},
        alt_text = coalesce(${dto.altText ?? null}, public.business_images.alt_text)
      where id = ${imageId}::uuid
      returning id, sort_order, is_primary`;
    if (!updated.length) throw new BadRequestException('Image not found');

    // Old asset cleanup AFTER the row points at the new asset — no orphan.
    if (row.public_id && row.public_id !== dto.publicId) {
      await this.uploads.deleteImage(row.public_id);
    }
    return { imageId, sortOrder: updated[0].sort_order, isPrimary: updated[0].is_primary };
  }
}
