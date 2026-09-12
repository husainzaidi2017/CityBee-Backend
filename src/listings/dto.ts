import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Category slug → business kind (mirrors the admin panel's CATEGORY_KIND). */
export const CATEGORY_KIND: Record<string, string> = {
  doctors: 'doctor',
  restaurants: 'restaurant',
  hotels: 'hotel',
  salons: 'salon',
  barber: 'salon',
  fashion: 'shop',
  shops: 'shop',
  malls: 'mall',
  cinemas: 'service',
  heritages: 'shop',
  grocery: 'shop',
};

export class SubmitListingDto {
  @IsString() @MinLength(2) @MaxLength(160) businessName: string;

  /** Category slug (e.g. "doctors"); kind derived server-side. */
  @IsString() @MinLength(2) @MaxLength(60) categorySlug: string;

  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;

  @IsString() @Matches(/^\+?[0-9]{10,15}$/, { message: 'phone must be a valid number' })
  phone: string;

  @IsOptional() @IsString() @Matches(/^\+?[0-9]{10,15}$/) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;

  @IsString() @MinLength(6) @MaxLength(400) address: string;
  @IsOptional() @IsString() @MaxLength(120) locality?: string;

  // City (from Google Places selection, matching the admin panel flow).
  @IsString() @MinLength(2) @MaxLength(120) cityName: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) cityLat?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) cityLng?: number;
  @IsOptional() @IsString() cityPlaceId?: string;

  // Business location (required: nearby discovery depends on it).
  @IsNumber() @Min(-90) @Max(90) bizLat: number;
  @IsNumber() @Min(-180) @Max(180) bizLng: number;
  @IsOptional() @IsString() bizPlaceId?: string;

  @IsOptional() @IsString() @MaxLength(120) openingHours?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsString({ each: true }) imageUrls?: string[];

  // ── Doctor ────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(120) specialization?: string;
  @IsOptional() @IsString() @MaxLength(200) qualification?: string;
  @IsOptional() @Type(() => Number) @Min(0) @Max(80) experienceYears?: number;
  @IsOptional() @IsString() @MaxLength(30) consultationFee?: string;

  // ── Restaurant ─────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(200) cuisine?: string;
  @IsOptional() @IsString() @MaxLength(60) priceRange?: string;
  @IsOptional() @IsIn(['veg', 'non_veg', 'mixed']) vegType?: string;

  // ── Hotel ──────────────────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(80) hotelType?: string;
  @IsOptional() @IsString() checkInTime?: string; // HH:MM
  @IsOptional() @IsString() checkOutTime?: string; // HH:MM
  @IsOptional() @IsArray() @ArrayMaxSize(12) @Length(1, 60, { each: true }) amenities?: string[];

  // ── Salon / service businesses ─────────────────────────────────────
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  serviceNames?: string[];
}


export class RejectSubmissionDto {
  @IsString() @MinLength(2) @MaxLength(500) note: string;
}
