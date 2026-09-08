import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Sql } from 'postgres';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
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
}

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
  @ApiOperation({ summary: 'Upload one image to Cloudinary (returns secureUrl + publicId)' })
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
  @ApiOperation({ summary: 'Upload up to 8 images to Cloudinary' })
  async uploadImages(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('Attach images in the "files" field');
    return this.uploads.uploadImages(files, 'citybee/unsorted');
  }

  @Post('associate')
  @ApiOperation({ summary: 'Link an uploaded Cloudinary image to an entity (owner/admin only)' })
  async associate(@CurrentUser() user: AuthUser, @Body() dto: AssociateImageDto) {
    if (dto.entityType === 'business') {
      const owns = await this.db`
        select 1 from public.businesses where id = ${dto.entityId}::uuid
          and (owner_id = ${user.id}::uuid
               or exists (select 1 from public.users u where u.id = ${user.id}::uuid and u.role = 'admin'))`;
      if (!owns.length) throw new BadRequestException('You can only manage images of your own business');
      const rows = await this.db`
        insert into public.business_images (business_id, image_url, public_id, alt_text, sort_order, is_primary)
        values (${dto.entityId}::uuid, ${dto.imageUrl}, ${dto.publicId ?? null}, ${dto.altText ?? null}, 0, false)
        returning id`;
      return { imageId: rows[0].id, entityType: 'business', entityId: dto.entityId };
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
}
