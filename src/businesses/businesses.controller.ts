import { BadRequestException, Controller, Get, Inject, Logger, Param, Post, Query, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Sql } from 'postgres';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Public } from '../auth/public.decorator';
import { CurrentUser, AuthUser } from '../auth/auth-user.decorator';
import { DATABASE } from '../database/database.module';
import { ListBusinessesDto, NearbyBusinessesDto, SearchBusinessesDto } from '../common/dto/query.dto';
import { BusinessesService } from './businesses.service';
import { UploadsService } from '../uploads/uploads.service';

export class CreateBusinessDto {
  @IsString()
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsIn(['restaurant', 'doctor', 'hotel', 'salon', 'shop', 'mall', 'service'])
  kind?: string;

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

  /** Direct category link (slug). Falls back to the kind→category map. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categorySlug?: string;

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

/** One item of a bulk import: business fields + image URLs to fetch. */
export class BulkBusinessItemDto extends CreateBusinessDto {
  /** Public image URLs (1–5). The backend downloads, optimizes and hosts
   *  each on Cloudinary — callers never upload binaries. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsUrl({ require_tld: true }, { each: true })
  imageUrls?: string[];
}

export class BulkImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => BulkBusinessItemDto)
  businesses: BulkBusinessItemDto[];
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Kind ↔ category mapping — PURE PLURAL RULES, no special cases:
 *   kind "grocery"  → category "groceries"
 *   kind "shop"     → category "shops"
 *   kind "doctor"   → category "doctors"
 * Any kind value maps to its English plural; the link step verifies the
 * category exists in public.categories before connecting (unknown
 * plural → no link, admin can attach any category from the panel).
 */

/** English plural: grocery→groceries, shop→shops, box→boxes. */
const pluralize = (kind: string): string => {
  if (kind.endsWith('y')) return `${kind.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(kind)) return `${kind}es`;
  return `${kind}s`;
};

/** Candidate category slugs for a kind (plural first, raw kind second). */
const categoryCandidatesForKind = (kind: string): string[] => [
  pluralize(kind),
  kind,
];

/** English singular: groceries→grocery, shops→shop, boxes→box. */
const singularize = (word: string): string => {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (/(ses|xes|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
};

/** Candidate kinds for a category slug (singular first, raw slug second). */
const kindCandidatesForCategory = (categorySlug: string): string[] => [
  singularize(categorySlug),
  categorySlug,
];

@ApiTags('businesses')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  private readonly logger = new Logger(BusinessesController.name);

  constructor(
    private readonly businesses: BusinessesService,
    @Inject(DATABASE) private readonly db: Sql,
    private readonly uploads: UploadsService,
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
      'Create a business (caller becomes owner). Dedups on google_place_id.',
  })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateBusinessDto) {
    return this.createOne(user, dto);
  }

  /**
   * BULK IMPORT — one call for up to 25 businesses. For every item the
   * backend: dedups (google_place_id/slug) → creates the business + kind
   * extension + category link → downloads each imageUrl → optimizes (≤1200px
   * WebP) → uploads to Cloudinary under citybee/businesses/{id}/ → links as
   * business_images (first = primary). Item-level failures never abort the
   * batch; every result is reported.
   */
  @Post('bulk')
  @ApiOperation({
    summary:
      'Bulk import up to 25 businesses with image URLs in ONE call (dedup + create + image pipeline server-side)',
  })
  async bulkCreate(@CurrentUser() user: AuthUser, @Body() dto: BulkImportDto) {
    const results = [] as Array<Record<string, unknown>>;
    let created = 0;
    let reused = 0;
    let failed = 0;

    for (const item of dto.businesses) {
      const entry: Record<string, unknown> = { name: item.name };
      try {
        const made = await this.createOne(user, item);
        entry.businessId = made.businessId;
        entry.slug = made.slug;
        entry.created = made.created;
        entry.reason = made.reason;
        made.created ? created++ : reused++;

        if (item.imageUrls?.length && made.businessId) {
          const images = await this.attachImages(made.businessId as string, item.imageUrls, item.name);
          entry.images = images;
        }
      } catch (err) {
        failed++;
        entry.error = err instanceof BadRequestException ? err.message : 'Import failed for this item';
        this.logger.warn(`Bulk item "${item.name}" failed: ${err instanceof Error ? err.message : err}`);
      }
      results.push(entry);
    }

    return { total: dto.businesses.length, created, reused, failed, results };
  }

  // ── shared internals ────────────────────────────────────────────────────

  private async createOne(user: AuthUser, dto: CreateBusinessDto) {
    // kind is optional: derive from the explicit categorySlug dynamically
    // (category "groceries" → kind "grocery"; "dining" → "restaurant").
    const kind = dto.kind ?? this.deriveKindFromCategory(dto.categorySlug);
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const point =
      dto.latitude != null && dto.longitude != null
        ? this.db`st_setsrid(st_makepoint(${dto.longitude}, ${dto.latitude}), 4326)::geography`
        : null;

    // DEDUP: same Google Place ID → reuse, never duplicate.
    if (dto.googlePlaceId) {
      const existing = await this.db`
        select id, slug from public.businesses where google_place_id = ${dto.googlePlaceId} limit 1`;
      if (existing.length) {
        return { businessId: existing[0].id, slug: existing[0].slug, created: false, reason: 'google_place_id_exists' };
      }
    }
    // DEDUP: same slug → reuse.
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
        ${slug}, ${dto.name}, ${kind}, ${dto.tagline ?? ''}, ${dto.description ?? ''},
        ${dto.phone ?? null}, ${dto.whatsapp ?? null}, ${dto.address ?? ''}, ${dto.locality ?? null},
        ${
          dto.latitude != null && dto.longitude != null
            ? this.db`(select id from public.cities order by ((latitude - ${dto.latitude}) * (latitude - ${dto.latitude}) + (longitude - ${dto.longitude}) * (longitude - ${dto.longitude})) limit 1)`
            : this.db`(select id from public.cities where slug = 'moradabad')`
        },
        ${point}, ${dto.googlePlaceId ?? null}, 'approved', ${user.id}::uuid
      )
      on conflict (slug) do update set updated_at = now()
      returning id, slug`;
    const businessId = rows[0].id as string;

    // Doctor extension row.
    if (kind === 'doctor') {
      await this.db`
        insert into public.doctors (business_id, name, specialization, qualification, experience_years, consultation_fee)
        values (${businessId}::uuid, ${dto.doctorName ?? dto.name}, ${dto.specialization ?? ''},
                ${dto.qualification ?? null}, ${dto.experienceYears ?? null}, ${dto.consultationFee ?? null})
        on conflict (business_id) do nothing`;
    }

    // Category link — dynamic: explicit categorySlug wins; otherwise the
    // kind's plural is resolved against the categories table so NEW
    // categories (groceries, shops…) work without code changes.
    if (dto.categorySlug) {
      await this.db`
        insert into public.business_categories (business_id, category_id)
        select ${businessId}::uuid, c.id from public.categories c
        where c.slug = ${dto.categorySlug}
        on conflict do nothing`;
    } else {
      // Candidates: plural forms + the raw kind — link whichever exists.
      const candidates = categoryCandidatesForKind(kind);
      await this.db`
        insert into public.business_categories (business_id, category_id)
        select ${businessId}::uuid, c.id from public.categories c
        where c.slug = any(${candidates}::text[])
        order by array_position(${candidates}::text[], c.slug)
        limit 1
        on conflict do nothing`;
    }

    return { businessId, slug, created: true };
  }

  /** kind for a category slug (dynamic; validated against known kinds). */
  private deriveKindFromCategory(categorySlug?: string): string {
    if (!categorySlug) return 'service';
    const KINDS = ['restaurant', 'doctor', 'hotel', 'salon', 'shop', 'mall', 'service'];
    for (const candidate of kindCandidatesForCategory(categorySlug)) {
      if (KINDS.includes(candidate)) return candidate;
    }
    return 'service';
  }

  /** Downloads each image URL, uploads optimized to Cloudinary, links rows. */
  private async attachImages(businessId: string, urls: string[], name: string) {
    const attached: Array<{ imageId: string; publicId: string }> = [];
    for (const [i, url] of urls.entries()) {
      try {
        let res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });

        // Google Places photo URLs 302-redirect to lh3.googleusercontent.com,
        // which some datacenter networks reject. The documented fix is
        // skipHttpRedirect=true → JSON { photoUri } pointing at the asset.
        if (!res.ok && url.includes('places.googleapis.com')) {
          const directJson = await fetch(
            url + (url.includes('?') ? '&' : '?') + 'skipHttpRedirect=true',
            { signal: AbortSignal.timeout(20_000) },
          );
          if (directJson.ok) {
            const { photoUri } = (await directJson.json()) as { photoUri?: string };
            if (photoUri) {
              res = await fetch(photoUri, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
            }
          }
        }

        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.startsWith('image/')) throw new Error('not an image');
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 10 * 1024 * 1024) throw new Error('over 10MB');

        const uploaded = await this.uploads.uploadImage(
          { buffer, mimetype: contentType, size: buffer.length } as Express.Multer.File,
          `citybee/businesses/${businessId}`,
        );

        try {
          await this.db`
            insert into public.business_images (business_id, image_url, public_id, alt_text, sort_order, is_primary)
            values (${businessId}::uuid, ${uploaded.secureUrl}, ${uploaded.publicId}, ${name}, ${i}, ${i === 0})`;
        } catch (err) {
          // Same Cloudinary asset already linked to this business → idempotent
          // success for imports (re-pushing the same photo is not an error).
          const msg = err instanceof Error ? err.message : '';
          if (!msg.includes('business_images_public_id_uidx')) throw err;
        }
        attached.push({ imageId: uploaded.publicId, publicId: uploaded.publicId });
      } catch (err) {
        this.logger.warn(`Image ${i + 1} for "${name}" failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    return attached;
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Business detail by UUID or slug (with menu, reviews, extensions)' })
  findOne(@Param('id') id: string) {
    return this.businesses.findByIdOrSlug(id);
  }
}
