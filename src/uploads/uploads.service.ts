import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary uploads from the secure backend only — the API secret never
 * reaches Flutter. Folder strategy:
 *   citybee/businesses/{businessId}/
 *   citybee/offers/{offerId}/
 *   citybee/places/{placeId}/
 *   citybee/profiles/{userId}/
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get('cloudinary.cloudName'),
      api_key: this.config.get('cloudinary.apiKey'),
      api_secret: this.config.get('cloudinary.apiSecret'),
      secure: true,
    });
  }

  private assertConfigured() {
    if (!this.config.get('cloudinary.cloudName') || !this.config.get('cloudinary.apiKey')) {
      throw new BadRequestException('Image uploads are not configured on the server');
    }
  }

  private assertImage(file: Express.Multer.File) {
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image must be under 10 MB');
    }
  }

  async uploadImage(file: Express.Multer.File, folder: string) {
    this.assertConfigured();
    this.assertImage(file);
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder, resource_type: 'image' }, (error, result) =>
            error ? reject(error) : resolve(result!),
          )
          .end(file.buffer);
      });
      return { secureUrl: result.secure_url, publicId: result.public_id };
    } catch (err) {
      this.logger.error(`Cloudinary upload failed: ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException('Image upload failed. Please try again.');
    }
  }

  async uploadImages(files: Express.Multer.File[], folder: string) {
    const results = [];
    for (const file of files) {
      results.push(await this.uploadImage(file, folder));
    }
    return results;
  }

  async deleteImage(publicId: string) {
    this.assertConfigured();
    await cloudinary.uploader.destroy(publicId).catch((err) => {
      this.logger.warn(`Cloudinary delete failed for ${publicId}: ${err}`);
    });
    return { deleted: true };
  }
}
