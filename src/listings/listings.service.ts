import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { AuthUser } from '../auth/auth-user.decorator';
import { SubmitListingDto } from './dto';

/**
 * List-Your-Business flow built on the EXISTING business_submissions
 * pipeline (the admin panel already reviews this table).
 *
 *  - Flutter submits → row with status 'pending', submitter_user_id = JWT user
 *  - Admin approves → backend converts to a real business and assigns
 *    owner_id = submitter_user_id, then notifies the owner
 *  - Consumer APIs only ever serve approved businesses (existing behavior)
 */
@Injectable()
export class ListingsService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  // ── submit ────────────────────────────────────────────────────────────

  async submit(user: AuthUser, dto: SubmitListingDto) {
    // Category must exist.
    const category = await this.db`
      select id, name, default_kind from public.categories
      where slug = ${dto.categorySlug} and is_active limit 1`;
    if (!category.length) {
      throw new BadRequestException('Choose a valid business category.');
    }
    // Kind comes from the category itself (categories.default_kind) —
    // new categories added later automatically map to the right kind.
    const kind = (category[0].default_kind as string) ?? 'service';

    // Category-specific requirements.
    if (kind === 'doctor' && (dto.specialization ?? '').trim().length < 2) {
      throw new BadRequestException('Please enter your specialization.');
    }

    // Duplicate detection: same business place id, or same name + address.
    if (dto.bizPlaceId) {
      const dupe = await this.db`
        select 1 from public.businesses where google_place_id = ${dto.bizPlaceId} limit 1`;
      if (dupe.length) {
        throw new BadRequestException(
          'This business may already be listed on CityBee.',
        );
      }
    }
    const dupeName = await this.db`
      select 1 from public.business_submissions
      where lower(business_name) = lower(${dto.businessName})
        and lower(address) = lower(${dto.address})
        and status = 'pending' limit 1`;
    if (dupeName.length) {
      throw new BadRequestException(
        'You already have a pending submission for this business.',
      );
    }

    const rows = await this.db`
      insert into public.business_submissions
        (submitter_user_id, submitter_name, submitter_phone, submitter_email,
         business_name, kind, category_slug, tagline, description,
         phone, whatsapp, website, address, locality,
         city_slug, city_name, city_lat, city_lng, city_place_id,
         biz_lat, biz_lng, biz_place_id, opening_hours,
         specialization, qualification, experience_years, consultation_fee,
         cuisine, price_range, veg_type, hotel_type, amenities, check_in_time, check_out_time,
         image_urls, status, submitted_at)
      values (
        ${user.id}::uuid,
        ${dto.businessName},
        ${dto.phone},
        ${dto.email ?? null},
        ${dto.businessName},
        ${kind},
        ${dto.categorySlug},
        ${dto.tagline ?? ''},
        ${dto.description ?? ''},
        ${dto.phone},
        ${dto.whatsapp ?? null},
        ${dto.website ?? null},
        ${dto.address},
        ${dto.locality ?? null},
        ${this.slugify(dto.cityName)},
        ${dto.cityName},
        ${dto.cityLat ?? null},
        ${dto.cityLng ?? null},
        ${dto.cityPlaceId ?? null},
        ${dto.bizLat},
        ${dto.bizLng},
        ${dto.bizPlaceId ?? null},
        ${dto.openingHours ?? null},
        ${dto.specialization ?? null},
        ${dto.qualification ?? null},
        ${dto.experienceYears ?? null},
        ${dto.consultationFee ?? null},
        ${dto.cuisine ?? null},
        ${dto.priceRange ?? null},
        ${dto.vegType ?? null},
        ${dto.hotelType ?? null},
        ${dto.amenities?.length ? dto.amenities.join(', ') : null},
        ${dto.checkInTime ?? null},
        ${dto.checkOutTime ?? null},
        ${dto.imageUrls?.length ? JSON.stringify(dto.imageUrls) : null},
        'pending', now())
      returning id, submitted_at`;
    return {
      submissionId: rows[0].id,
      status: 'pending',
      submittedAt: rows[0].submitted_at,
    };
  }

  /** All submissions by the caller (any status). */
  async mySubmissions(user: AuthUser) {
    const rows = await this.db`
      select s.id, s.business_name, s.category_slug, s.status, s.rejection_reason,
             s.submitted_at, s.reviewed_at, s.city_name,
             (s.image_urls is not null and s.image_urls <> '[]') as has_images
      from public.business_submissions s
      where s.submitter_user_id = ${user.id}::uuid
      order by s.submitted_at desc`;
    return rows.map((s) => ({
      id: s.id,
      businessName: s.business_name,
      categorySlug: s.category_slug,
      status: s.status,
      rejectionReason: s.rejection_reason ?? '',
      submittedAt: s.submitted_at,
      reviewedAt: s.reviewed_at,
      cityName: s.city_name ?? '',
      hasImages: s.has_images,
    }));
  }

  /** Full detail of one own submission — prefills the edit wizard. */
  async mySubmissionDetail(user: AuthUser, submissionId: string) {
    const rows = await this.db`
      select * from public.business_submissions
      where id = ${submissionId}::uuid and submitter_user_id = ${user.id}::uuid`;
    if (!rows.length) throw new NotFoundException('Submission not found');
    const s = rows[0];
    let imageUrls: string[] = [];
    if (s.image_urls) {
      try {
        imageUrls = (JSON.parse(String(s.image_urls)) as string[]).filter(
          (u) => typeof u === 'string',
        );
      } catch {
        imageUrls = [];
      }
    }
    return {
      id: s.id,
      businessName: s.business_name,
      categorySlug: s.category_slug,
      tagline: s.tagline ?? '',
      description: s.description ?? '',
      phone: s.phone ?? '',
      whatsapp: s.whatsapp ?? '',
      email: s.submitter_email ?? '',
      website: s.website ?? '',
      address: s.address ?? '',
      locality: s.locality ?? '',
      cityName: s.city_name ?? '',
      cityLat: s.city_lat,
      cityLng: s.city_lng,
      bizLat: s.biz_lat,
      bizLng: s.biz_lng,
      openingHours: s.opening_hours ?? '',
      specialization: s.specialization ?? '',
      qualification: s.qualification ?? '',
      experienceYears: s.experience_years,
      consultationFee: s.consultation_fee ?? '',
      cuisine: s.cuisine ?? '',
      priceRange: s.price_range ?? '',
      vegType: s.veg_type ?? 'mixed',
      hotelType: s.hotel_type ?? '',
      checkInTime: s.check_in_time ?? '',
      checkOutTime: s.check_out_time ?? '',
      amenities: s.amenities ? String(s.amenities).split(',').map((a) => a.trim()).filter(Boolean) : [],
      imageUrls,
      status: s.status,
      rejectionReason: s.rejection_reason ?? '',
      submittedAt: s.submitted_at,
    };
  }

  /**
   * Edit a REJECTED own submission (fields the wizard collects). Combined
   * with resubmit: edit → save → status flips back to pending.
   */
  async editSubmission(user: AuthUser, submissionId: string, dto: SubmitListingDto) {
    const rows = await this.db`
      select id, status from public.business_submissions
      where id = ${submissionId}::uuid and submitter_user_id = ${user.id}::uuid`;
    if (!rows.length) throw new NotFoundException('Submission not found');
    if (rows[0].status !== 'rejected') {
      throw new BadRequestException('Only rejected submissions can be edited.');
    }
    if (dto.categorySlug) {
      const cat = await this.db`
        select id from public.categories
        where slug = ${dto.categorySlug} and is_active limit 1`;
      if (!cat.length) throw new BadRequestException('Choose a valid business category.');
    }
    await this.db`
      update public.business_submissions set
        business_name = coalesce(${dto.businessName ?? null}, business_name),
        kind = coalesce(${dto.categorySlug
          ? (await this.db`select default_kind from public.categories where slug = ${dto.categorySlug} limit 1`)[0]
              ?.default_kind ?? null
          : null}, kind),
        category_slug = coalesce(${dto.categorySlug ?? null}, category_slug),
        tagline = coalesce(${dto.tagline ?? null}, tagline),
        description = coalesce(${dto.description ?? null}, description),
        phone = coalesce(${dto.phone ?? null}, phone),
        whatsapp = coalesce(${dto.whatsapp ?? null}, whatsapp),
        website = coalesce(${dto.website ?? null}, website),
        address = coalesce(${dto.address ?? null}, address),
        locality = coalesce(${dto.locality ?? null}, locality),
        city_name = coalesce(${dto.cityName ?? null}, city_name),
        city_lat = coalesce(${dto.cityLat ?? null}, city_lat),
        city_lng = coalesce(${dto.cityLng ?? null}, city_lng),
        biz_lat = coalesce(${dto.bizLat ?? null}, biz_lat),
        biz_lng = coalesce(${dto.bizLng ?? null}, biz_lng),
        opening_hours = coalesce(${dto.openingHours ?? null}, opening_hours),
        specialization = coalesce(${dto.specialization ?? null}, specialization),
        qualification = coalesce(${dto.qualification ?? null}, qualification),
        experience_years = coalesce(${dto.experienceYears ?? null}, experience_years),
        consultation_fee = coalesce(${dto.consultationFee ?? null}, consultation_fee),
        cuisine = coalesce(${dto.cuisine ?? null}, cuisine),
        price_range = coalesce(${dto.priceRange ?? null}, price_range),
        veg_type = coalesce(${dto.vegType ?? null}, veg_type),
        hotel_type = coalesce(${dto.hotelType ?? null}, hotel_type),
        check_in_time = coalesce(${dto.checkInTime ?? null}, check_in_time),
        check_out_time = coalesce(${dto.checkOutTime ?? null}, check_out_time),
        amenities = coalesce(${dto.amenities?.length ? dto.amenities.join(', ') : null}, amenities),
        image_urls = coalesce(${dto.imageUrls?.length ? JSON.stringify(dto.imageUrls) : null}, image_urls)
      where id = ${submissionId}::uuid`;
    return { id: submissionId, updated: true };
  }

  /**
   * Resubmit a rejected submission: back to pending with a fresh timestamp
   * (no duplicate row — the spec forbids versioned duplicates).
   */
  async resubmit(user: AuthUser, submissionId: string) {
    const rows = await this.db`
      select id, status from public.business_submissions
      where id = ${submissionId}::uuid and submitter_user_id = ${user.id}::uuid`;
    if (!rows.length) throw new NotFoundException('Submission not found');
    if (rows[0].status !== 'rejected') {
      throw new BadRequestException('Only rejected submissions can be resubmitted.');
    }
    await this.db`
      update public.business_submissions
      set status = 'pending', submitted_at = now(), reviewed_at = null
      where id = ${submissionId}::uuid`;
    return { id: submissionId, status: 'pending', resubmitted: true };
  }

  // ── admin approve / reject ───────────────────────────────────────────

  private async requireAdmin(user: AuthUser): Promise<void> {
    const rows = await this.db`
      select 1 from public.users where id = ${user.id}::uuid and role = 'admin'`;
    if (!rows.length) throw new ForbiddenException('Admin access required');
  }

  async approve(user: AuthUser, submissionId: string) {
    await this.requireAdmin(user);
    const subs = await this.db`
      select * from public.business_submissions where id = ${submissionId}::uuid`;
    if (!subs.length) throw new NotFoundException('Submission not found');
    const s = subs[0];
    if (s.status === 'approved') {
      throw new BadRequestException('Submission already approved');
    }

    const updateTargetId =
      typeof s.admin_note === 'string' && s.admin_note.startsWith('update:')
        ? s.admin_note.slice('update:'.length)
        : null;
    if (updateTargetId) {
      const cityId = await this.resolveCity(s);
      const updated = await this.db`
        update public.businesses set
          name = ${s.business_name},
          kind = ${s.kind},
          tagline = ${s.tagline ?? ''},
          description = ${s.description ?? ''},
          phone = ${s.phone ?? null},
          whatsapp = ${s.whatsapp ?? null},
          email = ${s.submitter_email ?? null},
          website = ${s.website ?? null},
          address = ${s.address ?? ''},
          locality = ${s.locality ?? null},
          city_id = ${cityId}::uuid,
          location = ${s.biz_lat != null && s.biz_lng != null
            ? this.db`st_setsrid(st_makepoint(${s.biz_lng}, ${s.biz_lat}), 4326)::geography`
            : null},
          opening_hours = ${s.opening_hours ?? null},
          status = 'approved',
          updated_at = now()
        where id = ${updateTargetId}::uuid
        returning id, slug`;
      if (!updated.length) throw new NotFoundException('Business not found');
      await this.finishApproval(s, updated[0].id, updated[0].slug, false);
      return { businessId: updated[0].id, slug: updated[0].slug, created: false };
    }

    // Already a business with this place id? Link, don't duplicate.
    if (s.biz_place_id) {
      const existing = await this.db`
        select id, slug from public.businesses
        where google_place_id = ${s.biz_place_id} limit 1`;
      if (existing.length) {
        await this.db`
          update public.businesses set owner_id = ${s.submitter_user_id}::uuid
          where id = ${existing[0].id}::uuid`;
        await this.finishApproval(s, existing[0].id, existing[0].slug, false);
        return { businessId: existing[0].id, slug: existing[0].slug, created: false };
      }
    }

    // Resolve the city (find-or-create, mirroring the admin panel logic).
    const cityId = await this.resolveCity(s);
    const slug = this.slugify(String(s.business_name)).slice(0, 60);
    const uniqueSlug = await this.uniqueSlug(slug);

    const created = await this.db`
      insert into public.businesses
        (owner_id, slug, name, kind, tagline, description, phone, whatsapp,
         email, website, address, locality, city_id, location, google_place_id,
         opening_hours, status, is_verified, is_pure_veg)
      values (
        ${s.submitter_user_id}::uuid, ${uniqueSlug}, ${s.business_name},
        ${s.kind}, ${s.tagline ?? ''}, ${s.description ?? ''},
        ${s.phone ?? null}, ${s.whatsapp ?? null}, ${s.submitter_email ?? null},
        ${s.website ?? null},
        ${s.address ?? ''}, ${s.locality ?? null}, ${cityId}::uuid,
        ${s.biz_lat != null && s.biz_lng != null
          ? this.db`st_setsrid(st_makepoint(${s.biz_lng}, ${s.biz_lat}), 4326)::geography`
          : null},
        ${s.biz_place_id ?? null},
        ${s.opening_hours ?? null}, 'approved', false,
        ${s.veg_type === 'veg'})
      on conflict (slug) do update set
        owner_id = excluded.owner_id,
        name = excluded.name,
        kind = excluded.kind,
        tagline = excluded.tagline,
        description = excluded.description,
        phone = excluded.phone,
        whatsapp = excluded.whatsapp,
        email = excluded.email,
        website = excluded.website,
        address = excluded.address,
        locality = excluded.locality,
        city_id = excluded.city_id,
        location = excluded.location,
        google_place_id = coalesce(public.businesses.google_place_id, excluded.google_place_id),
        opening_hours = excluded.opening_hours,
        status = 'approved',
        updated_at = now()
      returning id, slug`;
    const businessId = created[0].id as string;
    const finalSlug = created[0].slug as string;

    // Category link.
    await this.db`
      insert into public.business_categories (business_id, category_id)
      select ${businessId}::uuid, id from public.categories
      where slug = ${s.category_slug}
      on conflict do nothing`;

    // Category extensions.
    if (s.kind === 'doctor' && s.specialization) {
      await this.db`
        insert into public.doctors
          (business_id, name, specialization, qualification, experience_years, consultation_fee, bio)
        values (${businessId}::uuid, ${s.business_name}, ${s.specialization},
                ${s.qualification ?? null}, ${s.experience_years ?? null},
                ${s.consultation_fee ?? null}, ${s.description ?? null})
        on conflict (business_id) do nothing`;
    }
    if (s.kind === 'restaurant' && (s.cuisine || s.veg_type)) {
      await this.db`
        insert into public.restaurants (business_id, cuisine, price_range, veg_type)
        values (${businessId}::uuid, ${s.cuisine ?? null}, ${s.price_range ?? null},
                ${s.veg_type ?? 'mixed'})
        on conflict (business_id) do nothing`;
    }
    if (s.kind === 'hotel' && s.hotel_type) {
      const hotel = await this.db`
        insert into public.hotels (business_id, hotel_type, price_range, check_in, check_out)
        values (${businessId}::uuid, ${s.hotel_type}, ${s.price_range ?? null},
                ${s.check_in_time ?? null}, ${s.check_out_time ?? null})
        on conflict (business_id) do update set updated_at = now()
        returning id`;
      if (hotel.length && s.amenities) {
        const list = String(s.amenities).split(',').map((a) => a.trim()).filter(Boolean).slice(0, 12);
        for (const amenity of list) {
          await this.db`
            insert into public.hotel_amenities (hotel_id, amenity)
            values (${hotel[0].id}::uuid, ${amenity})
            on conflict do nothing`;
        }
      }
    }

    // Images (max 5, first primary).
    if (s.image_urls) {
      try {
        const urls = (JSON.parse(String(s.image_urls)) as string[])
          .filter((u) => typeof u === 'string' && u.startsWith('https://'))
          .slice(0, 5);
        for (let i = 0; i < urls.length; i++) {
          await this.db`
            insert into public.business_images (business_id, image_url, public_id, sort_order, is_primary)
            values (${businessId}::uuid, ${urls[i]}, null, ${i}, ${i === 0})`;
        }
      } catch {
        // Malformed legacy image JSON — skip images, keep approval.
      }
    }

    await this.finishApproval(s, businessId, finalSlug, true);
    return { businessId, slug: finalSlug, created: true };
  }

  private async finishApproval(
    s: Record<string, unknown>,
    businessId: string,
    slug: string,
    created: boolean,
  ) {
    await this.db`
      update public.business_submissions
      set status = 'approved', reviewed_at = now(), rejection_reason = null
      where id = ${String(s.id)}::uuid`;
    // Notify the owner.
    const submitterId = s.submitter_user_id as string | null;
    const businessName = String(s.business_name);
    if (submitterId) {
      await this.db`
        insert into public.notifications (user_id, title, message)
        values (${submitterId}::uuid,
                'Your business has been approved',
                ${'Your business "' + businessName + '" is now live on CityBee.'})`;
    }
  }

  async reject(user: AuthUser, submissionId: string, note: string) {
    await this.requireAdmin(user);
    const subs = await this.db`
      select id, submitter_user_id, business_name from public.business_submissions
      where id = ${submissionId}::uuid`;
    if (!subs.length) throw new NotFoundException('Submission not found');
    const s = subs[0];
    await this.db`
      update public.business_submissions
      set status = 'rejected', admin_note = ${note}, rejection_reason = ${note},
          reviewed_at = now()
      where id = ${submissionId}::uuid`;
    const submitterId = s.submitter_user_id as string | null;
    const businessName = String(s.business_name);
    if (submitterId) {
      await this.db`
        insert into public.notifications (user_id, title, message)
        values (${submitterId}::uuid,
                'Your business listing needs changes',
                ${'Your listing "' + businessName + '" was not approved: ' + note})`;
    }
    return { id: submissionId, rejected: true };
  }

  // ── helpers ───────────────────────────────────────────────────────────

  private async resolveCity(s: Record<string, unknown>): Promise<string> {
    const slug = this.slugify(String(s.city_name ?? 'moradabad')) || 'moradabad';
    if (s.city_place_id) {
      const byPlace = await this.db`
        select id from public.cities where google_place_id = ${String(s.city_place_id)} limit 1`;
      if (byPlace.length) return byPlace[0].id as string;
    }
    const existing = await this.db`
      select id from public.cities
      where lower(slug) = ${slug} or lower(name) = lower(${String(s.city_name ?? slug)})
      limit 1`;
    if (existing.length) return existing[0].id as string;
    if (s.city_name) {
      const created = await this.db`
        insert into public.cities (slug, name, latitude, longitude, google_place_id, is_active)
        values (${slug}, ${String(s.city_name)}, ${(s.city_lat as number) ?? 0},
                ${(s.city_lng as number) ?? 0}, ${(s.city_place_id as string) ?? null}, true)
        on conflict (slug) do update set updated_at = now()
        returning id`;
      if (created.length) return created[0].id as string;
    }
    const fallback = await this.db`
      select id from public.cities where slug = 'moradabad' limit 1`;
    return fallback[0].id as string;
  }

  private async uniqueSlug(base: string): Promise<string> {
    const exists = await this.db`
      select 1 from public.businesses where slug = ${base} limit 1`;
    if (!exists.length) return base;
    const suffix = Date.now().toString(36).slice(-4);
    return `${base}-${suffix}`;
  }

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
}
