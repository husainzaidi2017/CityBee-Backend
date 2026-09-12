import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
export class UpdateBusinessDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(200) tagline?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(400) address?: string;
  @IsOptional() @IsString() @MaxLength(120) locality?: string;
  @IsOptional() @IsString() @MaxLength(12) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(120) openingHours?: string;
  @IsOptional() @Type(() => Number) @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @Min(-180) @Max(180) longitude?: number;
}

export class BusinessHourDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsBoolean() isClosed: boolean;
  @IsOptional() @IsString() openTime?: string; // "HH:MM"
  @IsOptional() @IsString() closeTime?: string;
}

export class UpdateHoursDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => BusinessHourDto)
  hours: BusinessHourDto[];
}


export class CreateOfferDto {
  @IsString() @MinLength(3) @MaxLength(160) title: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(60) badgeText?: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(60) couponCode?: string;
  @IsOptional() @IsString() @MaxLength(60) categoryTag?: string;
  @IsOptional() @IsIn(['percent', 'flat', 'bogo', 'other']) discountType?: string;
  @IsOptional() @Type(() => Number) @Min(0) discountValue?: number;
  @IsOptional() @IsString() validFrom?: string; // YYYY-MM-DD
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(2000) terms?: string;
  @IsOptional() @IsIn(['draft', 'active', 'inactive']) status?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imagePublicId?: string;
}

export class UpdateOfferDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(60) badgeText?: string;
  @IsOptional() @IsString() @MaxLength(200) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(60) couponCode?: string;
  @IsOptional() @IsString() @MaxLength(60) categoryTag?: string;
  @IsOptional() @IsIn(['percent', 'flat', 'bogo', 'other']) discountType?: string;
  @IsOptional() @Type(() => Number) @Min(0) discountValue?: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(2000) terms?: string;
  @IsOptional() @IsIn(['draft', 'active', 'inactive']) status?: string;
}

export class CreateMenuCategoryDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class UpdateMenuCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @Type(() => Number) sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class CreateMenuItemDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(30) price?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imagePublicId?: string;
  @IsOptional() @IsBoolean() isVeg?: boolean;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsUUID() menuCategoryId?: string;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class UpdateMenuItemDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(30) price?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() imagePublicId?: string;
  @IsOptional() @IsBoolean() isVeg?: boolean;
  @IsOptional() @IsBoolean() available?: boolean;
  @IsOptional() @IsUUID() menuCategoryId?: string;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class CreateBusinessServiceDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(30) price?: string;
  @IsOptional() @Type(() => Number) @Min(1) durationMinutes?: number;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class UpdateBusinessServiceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() @MaxLength(30) price?: string;
  @IsOptional() @Type(() => Number) @Min(1) durationMinutes?: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) sortOrder?: number;
}

export class UpdateDoctorDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(120) specialization?: string;
  @IsOptional() @IsString() @MaxLength(200) qualification?: string;
  @IsOptional() @Type(() => Number) @Min(0) @Max(80) experienceYears?: number;
  @IsOptional() @IsString() @MaxLength(30) consultationFee?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
}

export class UpdateRestaurantDto {
  @IsOptional() @IsString() @MaxLength(200) cuisine?: string;
  @IsOptional() @IsString() @MaxLength(60) priceRange?: string;
  @IsOptional() @IsIn(['veg', 'non_veg', 'mixed']) vegType?: string;
}

export class UpdateHotelDto {
  @IsOptional() @IsString() @MaxLength(80) hotelType?: string;
  @IsOptional() @IsString() @MaxLength(60) priceRange?: string;
  @IsOptional() @IsString() checkIn?: string; // HH:MM
  @IsOptional() @IsString() checkOut?: string;
}

export class UpdateAmenitiesDto {
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @Length(1, 60, { each: true })
  amenities: string[];
}
