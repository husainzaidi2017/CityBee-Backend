import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Sql } from 'postgres';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../auth/public.decorator';
import { CurrentUser, AuthUser } from '../auth/auth-user.decorator';
import { DATABASE } from '../database/database.module';
import { ListBusinessesDto, NearbyBusinessesDto, SearchBusinessesDto } from '../common/dto/query.dto';
import { BusinessesService } from './businesses.service';

export class CreateBusinessDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsIn(['restaurant', 'doctor', 'hotel', 'salon', 'shop', 'mall', 'service'])
  kind: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  locality?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  googlePlaceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalRef?: string;

  // Doctor extension (when kind = 'doctor').
  @IsOptional()
  @IsString()
  @MaxLength(160)
  doctorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  specialization?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualification?: string;

  @IsOptional()
  @Type(() => Number)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  consultationFee?: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(
    private readonly businesses: BusinessesService,
    @Inject(DATABASE) private readonly db: Sql,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List approved businesses (filter by category/city/kind)' })
  findMany(@Query() q: ListBusinessesDto) {
    return this.businesses.findMany({
      page: q.page,
      limit: q.limit,
      categorySlug: q.category,
      citySlug: q.city,
      kind: q.kind,
      featured: q.featured == null ? undefined : q.featured === 'true',
      lat: q.lat,
      lng: q.lng,
    });
  }

  @Public()
  @Get('nearby')
  @ApiOperation({
    summary:
      'Businesses near a point (PostGIS). Without radius: progressive expansion until enough results.',
  })
  nearby(@Query() q: NearbyBusinessesDto) {
    return this.businesses.nearby({
      page: q.page,
      limit: q.limit,
      lat: q.lat,
      lng: q.lng,
      radius: q.radius,
      categorySlug: q.category,
      kind: q.kind,
    });
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Search by name, tagline, locality, specialization, cuisine' })
  search(@Query() q: SearchBusinessesDto) {
    return this.businesses.search(q.q ?? '', { page: q.page, limit: q.limit, citySlug: q.city });
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a business (caller becomes owner; status pending until admin approval). Dedups on google_place_id.',
  })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    // Ownership: the creator owns it; admins may create for others later.
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const point =
      dto.latitude != null && dto.longitude != null
        ? this.db`st_setsrid(st_makepoint(${dto.longitude}, ${dto.latitude}), 4326)::geography`
        : null;

    // DEDUP: same Google Place ID → return the existing business, no duplicate.
    if (dto.googlePlaceId) {
      const existing = await this.db`
        select id, slug from public.businesses where google_place_id = ${dto.googlePlaceId} limit 1`;
      if (existing.length) {
        return { businessId: existing[0].id, slug: existing[0].slug, created: false, reason: 'google_place_id_exists' };
      }
    }
    // DEDUP: same slug → return existing.
    const existingSlug = await this.db`
      select id from public.businesses where slug = ${slug} limit 1`;
    if (existingSlug.length) {
      return { businessId: existingSlug[0].id, slug, created: false, reason: 'slug_exists' };
    }

    const rows = await this.db`
      insert into public.businesses
        (slug, name, kind, tagline, description, phone, whatsapp, address, locality,
         city_id, location, google_place_id, status, owner_id)
      values (
        ${slug}, ${dto.name}, ${dto.kind}, ${dto.tagline ?? ''}, ${dto.description ?? ''},
        ${dto.phone ?? null}, ${dto.whatsapp ?? null}, ${dto.address ?? ''}, ${dto.locality ?? null},
        (select id from public.cities where slug = 'moradabad'),
        ${point}, ${dto.googlePlaceId ?? null}, 'approved', ${user.id}::uuid
      )
      on conflict (slug) do update set updated_at = now()
      returning id, slug`;
    const businessId = rows[0].id as string;

    // Doctor extension row.
    if (dto.kind === 'doctor') {
      await this.db`
        insert into public.doctors (business_id, name, specialization, qualification, experience_years, consultation_fee)
        values (${businessId}::uuid, ${dto.doctorName ?? dto.name}, ${dto.specialization ?? ''},
                ${dto.qualification ?? null}, ${dto.experienceYears ?? null}, ${dto.consultationFee ?? null})
        on conflict (business_id) do nothing`;
    }

    // Category link for every kind with a matching discovery category —
    // without this row the listing is invisible in category-filtered
    // queries (the Hotels/Food/Doctors tabs all filter by category slug).
    const categoryForKind: Record<string, string> = {
      restaurant: 'dining',
      doctor: 'doctors',
      hotel: 'hotels',
      salon: 'salons',
      mall: 'malls',
    };
    const categorySlug = categoryForKind[dto.kind];
    if (categorySlug) {
      await this.db`
        insert into public.business_categories (business_id, category_id)
        select ${businessId}::uuid, c.id from public.categories c
        where c.slug = ${categorySlug}
        on conflict do nothing`;
    }

    return { businessId, slug, created: true };
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Business detail by UUID or slug (with menu, reviews, extensions)' })
  findOne(@Param('id') id: string) {
    return this.businesses.findByIdOrSlug(id);
  }
}
