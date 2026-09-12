import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';
import { AuthUser } from '../auth/auth-user.decorator';
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

/** Full business row owned by the caller (or admin). Throws otherwise. */
type OwnedBusiness = Record<string, unknown> & { id: string };

@Injectable()
export class MeService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  // ── ownership core ────────────────────────────────────────────────────

  private async isAdmin(user: AuthUser): Promise<boolean> {
    const rows = await this.db`
      select 1 from public.users where id = ${user.id}::uuid and role = 'admin'`;
    return rows.length > 0;
  }

  /**
   * The single ownership gate EVERY /me/businesses/:id route goes through.
   * The owner id comes from the verified JWT — never from the request body.
   */
  async requireOwnedBusiness(user: AuthUser, businessId: string): Promise<OwnedBusiness> {
    if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
      throw new BadRequestException('Invalid business id');
    }
    const rows = await this.db`
      select b.*, c.name as city_name, c.slug as city_slug,
             st_y(b.location::geometry) as latitude,
             st_x(b.location::geometry) as longitude
      from public.businesses b
      left join public.cities c on c.id = b.city_id
      where b.id = ${businessId}::uuid`;
    if (!rows.length) throw new NotFoundException('Business not found');
    const business = rows[0];
    if (business.owner_id !== user.id && !(await this.isAdmin(user))) {
      throw new ForbiddenException('You can only manage your own business');
    }
    return business as unknown as OwnedBusiness;
  }

  private async requireNested(user: AuthUser, businessId: string, table: string, rowId: string) {
    const owned = await this.requireOwnedBusiness(user, businessId);
    const rows = await this.db.unsafe(
      `select * from public.${table} where id = $1 and business_id = $2`,
      [rowId, businessId],
    );
    if (!rows.length) {
      throw new NotFoundException('Not found for this business');
    }
    return { owned, row: rows[0] };
  }

  // ── summary + list ────────────────────────────────────────────────────

  async summary(user: AuthUser) {
    const rows = await this.db`
      select
        count(*)::int as total,
        count(*) filter (where status = 'approved')::int as approved
      from public.businesses
      where owner_id = ${user.id}::uuid`;
    return {
      hasApprovedBusiness: rows[0].approved > 0,
      approvedBusinessCount: rows[0].approved,
      totalBusinessCount: rows[0].total,
    };
  }

  async listBusinesses(user: AuthUser) {
    const rows = await this.db`
      select b.id, b.slug, b.name, b.kind, b.tagline, b.status, b.is_verified,
             b.rating, b.review_count, b.locality,
             c.name as city_name, c.slug as city_slug,
             (select image_url from public.business_images bi
               where bi.business_id = b.id order by is_primary desc, sort_order limit 1) as primary_image,
             (select array_agg(cat.name order by cat.sort_order)
               from public.business_categories bc
               join public.categories cat on cat.id = bc.category_id
               where bc.business_id = b.id) as categories,
             (select count(*)::int from public.offers o
               where o.business_id = b.id and o.status = 'active') as active_offers
      from public.businesses b
      left join public.cities c on c.id = b.city_id
      where b.owner_id = ${user.id}::uuid
      order by b.created_at desc`;
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      kind: r.kind,
      tagline: r.tagline,
      status: r.status,
      isVerified: r.is_verified,
      rating: Number(r.rating),
      reviewCount: r.review_count,
      area: r.locality ?? '',
      cityName: r.city_name ?? '',
      citySlug: r.city_slug ?? '',
      primaryImage: r.primary_image ?? '',
      categories: (r.categories as string[] | null) ?? [],
      activeOffers: r.active_offers,
    }));
  }

  // ── management details ────────────────────────────────────────────────

  async businessDetails(user: AuthUser, businessId: string) {
    const b = await this.requireOwnedBusiness(user, businessId);
    const [categories, images, hours, offers, services, menuCategories, menuItems, doctor, restaurant, hotel, amenities] =
      await Promise.all([
        this.db`select c.slug, c.name from public.business_categories bc
                 join public.categories c on c.id = bc.category_id
                 where bc.business_id = ${businessId}::uuid order by c.sort_order`,
        this.db`select id, image_url, public_id, sort_order, is_primary
                 from public.business_images where business_id = ${businessId}::uuid
                 order by is_primary desc, sort_order`,
        this.db`select day_of_week, is_closed, open_time, close_time
                 from public.business_hours where business_id = ${businessId}::uuid
                 order by day_of_week`,
        this.db`select id, title, description, badge_text, subtitle, coupon_code,
                        category_tag, discount_type, discount_value, valid_from, valid_until,
                        status, is_featured, created_at
                 from public.offers where business_id = ${businessId}::uuid
                 order by created_at desc`,
        this.db`select id, name, description, price, duration_minutes, active, sort_order
                 from public.business_services where business_id = ${businessId}::uuid
                 order by sort_order, created_at`,
        this.db`select id, name, sort_order, active
                 from public.menu_categories where business_id = ${businessId}::uuid
                 order by sort_order, created_at`,
        this.db`select id, menu_category_id, name, description, price, image_url,
                        is_veg, available, sort_order
                 from public.menu_items where business_id = ${businessId}::uuid
                 order by sort_order, created_at`,
        this.db`select name, specialization, qualification, experience_years,
                        consultation_fee, bio from public.doctors
                 where business_id = ${businessId}::uuid`,
        this.db`select cuisine, price_range, veg_type from public.restaurants
                 where business_id = ${businessId}::uuid`,
        this.db`select id, hotel_type, price_range, check_in, check_out
                 from public.hotels where business_id = ${businessId}::uuid`,
        this.db`select amenity from public.hotel_amenities ha
                 join public.hotels h on h.id = ha.hotel_id
                 where h.business_id = ${businessId}::uuid`,
      ]);

    const reviewCount = b.review_count as number;

    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      kind: b.kind,
      tagline: b.tagline,
      description: b.description,
      phone: b.phone ?? '',
      whatsapp: b.whatsapp ?? '',
      email: b.email ?? '',
      website: b.website ?? '',
      address: b.address ?? '',
      locality: b.locality ?? '',
      postalCode: b.postal_code ?? '',
      openingHours: b.opening_hours ?? '',
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      status: b.status,
      rejectionReason: b.rejection_reason ?? '',
      isVerified: b.is_verified,
      rating: Number(b.rating),
      reviewCount,
      cityName: b.city_name ?? '',
      citySlug: b.city_slug ?? '',
      categories: categories.map((c) => ({ id: c.slug, name: c.name })),
      images: images.map((i) => ({
        id: i.id,
        url: i.image_url,
        publicId: i.public_id,
        sortOrder: i.sort_order,
        isPrimary: i.is_primary,
      })),
      hours: this.normalizeHours(hours),
      offers: offers.map((o) => this.mapOffer(o)),
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        price: s.price ?? '',
        durationMinutes: s.duration_minutes,
        active: s.active,
        sortOrder: s.sort_order,
      })),
      menu: {
        categories: menuCategories.map((c) => ({
          id: c.id, name: c.name, sortOrder: c.sort_order, active: c.active,
        })),
        items: menuItems.map((i) => ({
          id: i.id,
          categoryId: i.menu_category_id,
          name: i.name,
          description: i.description ?? '',
          price: i.price ?? '',
          imageUrl: i.image_url ?? '',
          isVeg: i.is_veg,
          available: i.available,
          sortOrder: i.sort_order,
        })),
      },
      doctor: doctor.length
        ? {
            name: doctor[0].name,
            specialization: doctor[0].specialization ?? '',
            qualification: doctor[0].qualification ?? '',
            experienceYears: doctor[0].experience_years,
            consultationFee: doctor[0].consultation_fee ?? '',
            bio: doctor[0].bio ?? '',
          }
        : null,
      restaurant: restaurant.length
        ? {
            cuisine: restaurant[0].cuisine ?? '',
            priceRange: restaurant[0].price_range ?? '',
            vegType: restaurant[0].veg_type ?? 'mixed',
          }
        : null,
      hotel: hotel.length
        ? {
            hotelType: hotel[0].hotel_type ?? '',
            priceRange: hotel[0].price_range ?? '',
            checkIn: hotel[0].check_in,
            checkOut: hotel[0].check_out,
            amenities: amenities.map((a) => a.amenity),
          }
        : null,
    };
  }

  private normalizeHours(rows: Array<Record<string, unknown>>) {
    const byDay = new Map<number, unknown>(rows.map((r) => [r.day_of_week as number, r]));
    return Array.from({ length: 7 }, (_, day) => {
      const row = byDay.get(day) as
        | { is_closed: boolean; open_time: string; close_time: string }
        | undefined;
      return {
        dayOfWeek: day,
        isClosed: row ? row.is_closed : false,
        openTime: row ? String(row.open_time).slice(0, 5) : '09:00',
        closeTime: row ? String(row.close_time).slice(0, 5) : '21:00',
        configured: !!row,
      };
    });
  }

  private mapOffer(o: Record<string, unknown>) {
    const today = new Date().toISOString().slice(0, 10);
    const validFrom = o.valid_from ? String(o.valid_from).slice(0, 10) : null;
    const validUntil = o.valid_until ? String(o.valid_until).slice(0, 10) : null;
    let phase = o.status as string;
    if (o.status === 'active') {
      if (validFrom && validFrom > today) phase = 'scheduled';
      else if (validUntil && validUntil < today) phase = 'expired';
    }
    return {
      id: o.id,
      title: o.title,
      description: o.description ?? '',
      badgeText: o.badge_text ?? '',
      subtitle: o.subtitle ?? '',
      couponCode: o.coupon_code ?? '',
      categoryTag: o.category_tag ?? 'All',
      discountType: o.discount_type,
      discountValue: o.discount_value != null ? Number(o.discount_value) : null,
      validFrom,
      validUntil,
      status: o.status,
      phase,
      isFeatured: o.is_featured,
      createdAt: o.created_at,
    };
  }

  // ── common business fields ────────────────────────────────────────────

  async updateBusiness(user: AuthUser, businessId: string, dto: UpdateBusinessDto) {
    await this.requireOwnedBusiness(user, businessId);
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (dto.name != null) add('name', dto.name);
    if (dto.tagline != null) add('tagline', dto.tagline);
    if (dto.description != null) add('description', dto.description);
    if (dto.phone != null) add('phone', dto.phone);
    if (dto.whatsapp != null) add('whatsapp', dto.whatsapp);
    if (dto.email != null) add('email', dto.email);
    if (dto.website != null) add('website', dto.website);
    if (dto.address != null) add('address', dto.address);
    if (dto.locality != null) add('locality', dto.locality);
    if (dto.postalCode != null) add('postal_code', dto.postalCode);
    if (dto.openingHours != null) add('opening_hours', dto.openingHours);
    if (dto.latitude != null && dto.longitude != null) {
      values.push(dto.longitude);
      const lng = values.length;
      values.push(dto.latitude);
      const lat = values.length;
      sets.push(`location = st_setsrid(st_makepoint($${lng}, $${lat}), 4326)::geography`);
    }
    if (!sets.length) throw new BadRequestException('Nothing to update');
    values.push(businessId);
    const rows = await this.db.unsafe(
      `update public.businesses set ${sets.join(', ')}, updated_at = now()
       where id = $${values.length} returning id, slug`,
      values as never[],
    );
    return { id: rows[0].id, slug: rows[0].slug, updated: true };
  }

  async requestBusinessUpdate(user: AuthUser, businessId: string, dto: UpdateBusinessDto) {
    const b = await this.requireOwnedBusiness(user, businessId);
    const category = await this.db`
      select c.slug from public.business_categories bc
      join public.categories c on c.id = bc.category_id
      where bc.business_id = ${businessId}::uuid
      order by c.sort_order limit 1`;
    const pending = await this.db`
      select 1 from public.business_submissions
      where admin_note = ${'update:' + businessId} and status = 'pending'
      limit 1`;
    if (pending.length) {
      throw new BadRequestException('A change request is already pending approval.');
    }
    const name = dto.name ?? String(b.name ?? '');
    const address = dto.address ?? String(b.address ?? '');
    const latitude = dto.latitude ?? Number(b.latitude ?? 0);
    const longitude = dto.longitude ?? Number(b.longitude ?? 0);
    const phone = dto.phone ?? (b.phone != null ? String(b.phone) : null);
    const whatsapp = dto.whatsapp ?? (b.whatsapp != null ? String(b.whatsapp) : null);
    const email = dto.email ?? (b.email != null ? String(b.email) : null);
    const website = dto.website ?? (b.website != null ? String(b.website) : null);
    const tagline = dto.tagline ?? String(b.tagline ?? '');
    const description = dto.description ?? String(b.description ?? '');
    const locality = dto.locality ?? (b.locality != null ? String(b.locality) : null);
    const openingHours = dto.openingHours ?? (b.opening_hours != null ? String(b.opening_hours) : null);
    const citySlug = b.city_slug != null ? String(b.city_slug) : null;
    const cityName = String(b.city_name ?? '');
    const kind = String(b.kind ?? 'service');
    const categorySlug = category[0]?.slug ? String(category[0].slug) : 'shops';
    const rows = await this.db`
      insert into public.business_submissions
        (admin_note, submitter_user_id, submitter_name, submitter_phone,
         submitter_email, business_name, kind, category_slug, tagline, description,
         phone, whatsapp, website, address, locality, city_slug, city_name,
         city_lat, city_lng, biz_lat, biz_lng, opening_hours, status, submitted_at)
      values (
        ${'update:' + businessId}, ${user.id}::uuid, ${name}, ${phone},
        ${email}, ${name}, ${kind}, ${categorySlug}, ${tagline},
        ${description}, ${phone}, ${whatsapp}, ${website}, ${address},
        ${locality}, ${citySlug}, ${cityName}, ${latitude || null},
        ${longitude || null}, ${latitude || null}, ${longitude || null},
        ${openingHours}, 'pending', now())
      returning id, submitted_at`;
    return { submissionId: rows[0].id, status: 'pending', submittedAt: rows[0].submitted_at };
  }

  // ── hours ─────────────────────────────────────────────────────────────

  async getHours(user: AuthUser, businessId: string) {
    await this.requireOwnedBusiness(user, businessId);
    const rows = await this.db`
      select day_of_week, is_closed, open_time, close_time
      from public.business_hours where business_id = ${businessId}::uuid
      order by day_of_week`;
    return this.normalizeHours(rows);
  }

  async updateHours(user: AuthUser, businessId: string, dto: UpdateHoursDto) {
    await this.requireOwnedBusiness(user, businessId);
    for (const h of dto.hours as BusinessHourDto[]) {
      const open = h.openTime ?? '09:00';
      const close = h.closeTime ?? '21:00';
      if (!h.isClosed && open >= close) {
        throw new BadRequestException(`Day ${h.dayOfWeek}: opening time must be before closing time`);
      }
      if (!/^\d{2}:\d{2}$/.test(open) || !/^\d{2}:\d{2}$/.test(close)) {
        throw new BadRequestException('Times must be in HH:MM format');
      }
    }
    await this.db.begin(async (txn) => {
      await txn`delete from public.business_hours where business_id = ${businessId}::uuid`;
      for (const h of dto.hours as BusinessHourDto[]) {
        await txn`
          insert into public.business_hours (business_id, day_of_week, is_closed, open_time, close_time)
          values (${businessId}::uuid, ${h.dayOfWeek}, ${h.isClosed}, ${h.openTime ?? '09:00'}, ${h.closeTime ?? '21:00'})`;
      }
    });
    return this.getHours(user, businessId);
  }

  // ── offers ────────────────────────────────────────────────────────────

  async listOffers(user: AuthUser, businessId: string) {
    await this.requireOwnedBusiness(user, businessId);
    const rows = await this.db`
      select id, title, description, badge_text, subtitle, coupon_code, category_tag,
             discount_type, discount_value, valid_from, valid_until, status, is_featured, created_at
      from public.offers where business_id = ${businessId}::uuid
      order by created_at desc`;
    return rows.map((o) => this.mapOffer(o));
  }

  private validateOfferDates(dto: {
    validFrom?: string;
    validUntil?: string;
    discountType?: string;
    discountValue?: number;
  }) {
    const from = dto.validFrom ?? null;
    const until = dto.validUntil ?? null;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !dateRe.test(from)) throw new BadRequestException('validFrom must be YYYY-MM-DD');
    if (until && !dateRe.test(until)) throw new BadRequestException('validUntil must be YYYY-MM-DD');
    if (from && until && from > until) {
      throw new BadRequestException('validUntil must not be before validFrom');
    }
    if (dto.discountType === 'percent') {
      const v = dto.discountValue;
      if (v != null && (v < 0 || v > 100)) {
        throw new BadRequestException('Percent discount must be between 0 and 100');
      }
    }
  }

  async createOffer(user: AuthUser, businessId: string, dto: CreateOfferDto) {
    await this.requireOwnedBusiness(user, businessId);
    this.validateOfferDates(dto);
    const rows = await this.db`
      insert into public.offers
        (business_id, title, description, badge_text, subtitle, coupon_code, category_tag,
         discount_type, discount_value, valid_from, valid_until, terms, status)
      values (${businessId}::uuid, ${dto.title}, ${dto.description ?? ''}, ${dto.badgeText ?? ''},
              ${dto.subtitle ?? ''}, ${dto.couponCode ?? null}, ${dto.categoryTag ?? 'All'},
              ${dto.discountType ?? null}, ${dto.discountValue ?? null},
              ${dto.validFrom ?? null}, ${dto.validUntil ?? null}, ${dto.terms ?? null},
              ${dto.status ?? 'active'})
      returning id`;
    if (dto.imageUrl) {
      await this.db`
        insert into public.offer_images (offer_id, image_url, public_id, is_primary)
        values (${rows[0].id}::uuid, ${dto.imageUrl}, ${dto.imagePublicId ?? null}, true)`;
    }
    return { offerId: rows[0].id, created: true };
  }

  async updateOffer(user: AuthUser, businessId: string, offerId: string, dto: UpdateOfferDto) {
    // Nested ownership: the offer must belong to THIS owned business.
    await this.requireNested(user, businessId, 'offers', offerId);
    this.validateOfferDates(dto);
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (dto.title != null) add('title', dto.title);
    if (dto.description != null) add('description', dto.description);
    if (dto.badgeText != null) add('badge_text', dto.badgeText);
    if (dto.subtitle != null) add('subtitle', dto.subtitle);
    if (dto.couponCode != null) add('coupon_code', dto.couponCode);
    if (dto.categoryTag != null) add('category_tag', dto.categoryTag);
    if (dto.discountType != null) add('discount_type', dto.discountType);
    if (dto.discountValue != null) add('discount_value', dto.discountValue);
    if (dto.validFrom !== undefined) add('valid_from', dto.validFrom ?? null);
    if (dto.validUntil !== undefined) add('valid_until', dto.validUntil ?? null);
    if (dto.terms != null) add('terms', dto.terms);
    if (dto.status != null) add('status', dto.status);
    if (!sets.length) throw new BadRequestException('Nothing to update');
    values.push(offerId);
    await this.db.unsafe(
      `update public.offers set ${sets.join(', ')}, updated_at = now() where id = $${values.length}`,
      values as never[],
    );
    return { offerId, updated: true };
  }

  async deleteOffer(user: AuthUser, businessId: string, offerId: string) {
    await this.requireNested(user, businessId, 'offers', offerId);
    await this.db`delete from public.offers where id = ${offerId}::uuid`;
    return { offerId, deleted: true };
  }

  // ── menu ──────────────────────────────────────────────────────────────

  async listMenu(user: AuthUser, businessId: string) {
    await this.requireOwnedBusiness(user, businessId);
    const [cats, items] = await Promise.all([
      this.db`select id, name, sort_order, active from public.menu_categories
               where business_id = ${businessId}::uuid order by sort_order, created_at`,
      this.db`select id, menu_category_id, name, description, price, image_url, is_veg, available, sort_order
               from public.menu_items where business_id = ${businessId}::uuid
               order by sort_order, created_at`,
    ]);
    return {
      categories: cats,
      items: items.map((i) => ({
        id: i.id,
        categoryId: i.menu_category_id,
        name: i.name,
        description: i.description ?? '',
        price: i.price ?? '',
        imageUrl: i.image_url ?? '',
        isVeg: i.is_veg,
        available: i.available,
        sortOrder: i.sort_order,
      })),
    };
  }

  async createMenuCategory(user: AuthUser, businessId: string, dto: CreateMenuCategoryDto) {
    await this.requireOwnedBusiness(user, businessId);
    const rows = await this.db`
      insert into public.menu_categories (business_id, name, sort_order)
      values (${businessId}::uuid, ${dto.name}, ${dto.sortOrder ?? 0})
      returning id, name, sort_order, active`;
    return rows[0];
  }

  async updateMenuCategory(user: AuthUser, businessId: string, categoryId: string, dto: UpdateMenuCategoryDto) {
    await this.requireNested(user, businessId, 'menu_categories', categoryId);
    const rows = await this.db`
      update public.menu_categories set
        name = coalesce(${dto.name ?? null}, name),
        sort_order = coalesce(${dto.sortOrder ?? null}, sort_order),
        active = coalesce(${dto.active ?? null}, active),
        updated_at = now()
      where id = ${categoryId}::uuid
      returning id, name, sort_order, active`;
    return rows[0];
  }

  async deleteMenuCategory(user: AuthUser, businessId: string, categoryId: string) {
    await this.requireNested(user, businessId, 'menu_categories', categoryId);
    // Items keep existing via ON DELETE SET NULL (uncategorized).
    await this.db`delete from public.menu_categories where id = ${categoryId}::uuid`;
    return { id: categoryId, deleted: true };
  }

  async createMenuItem(user: AuthUser, businessId: string, dto: CreateMenuItemDto) {
    await this.requireOwnedBusiness(user, businessId);
    if (dto.menuCategoryId) {
      const cat = await this.db`
        select 1 from public.menu_categories
        where id = ${dto.menuCategoryId}::uuid and business_id = ${businessId}::uuid`;
      if (!cat.length) throw new BadRequestException('menuCategoryId does not belong to this business');
    }
    const rows = await this.db`
      insert into public.menu_items
        (business_id, menu_category_id, name, description, price, image_url, is_veg, available, sort_order)
      values (${businessId}::uuid, ${dto.menuCategoryId ?? null}, ${dto.name}, ${dto.description ?? null},
              ${dto.price ?? null}, ${dto.imageUrl ?? null}, ${dto.isVeg ?? true}, ${dto.available ?? true},
              ${dto.sortOrder ?? 0})
      returning id`;
    return { itemId: rows[0].id, created: true };
  }

  async updateMenuItem(user: AuthUser, businessId: string, itemId: string, dto: UpdateMenuItemDto) {
    await this.requireNested(user, businessId, 'menu_items', itemId);
    if (dto.menuCategoryId) {
      const cat = await this.db`
        select 1 from public.menu_categories
        where id = ${dto.menuCategoryId}::uuid and business_id = ${businessId}::uuid`;
      if (!cat.length) throw new BadRequestException('menuCategoryId does not belong to this business');
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (dto.name != null) add('name', dto.name);
    if (dto.description != null) add('description', dto.description);
    if (dto.price != null) add('price', dto.price);
    if (dto.imageUrl != null) add('image_url', dto.imageUrl);
    if (dto.isVeg != null) add('is_veg', dto.isVeg);
    if (dto.available != null) add('available', dto.available);
    if (dto.menuCategoryId !== undefined) add('menu_category_id', dto.menuCategoryId ?? null);
    if (dto.sortOrder != null) add('sort_order', dto.sortOrder);
    if (!sets.length) throw new BadRequestException('Nothing to update');
    sets.push('updated_at = now()');
    values.push(itemId);
    const rows = await this.db.unsafe(
      `update public.menu_items set ${sets.join(', ')} where id = $${values.length} returning id`,
      values as never[],
    );
    return { itemId: rows[0].id, updated: true };
  }

  async deleteMenuItem(user: AuthUser, businessId: string, itemId: string) {
    await this.requireNested(user, businessId, 'menu_items', itemId);
    await this.db`delete from public.menu_items where id = ${itemId}::uuid`;
    return { id: itemId, deleted: true };
  }

  // ── business services (salon/barber/repair…) ─────────────────────────

  async listBusinessServices(user: AuthUser, businessId: string) {
    await this.requireOwnedBusiness(user, businessId);
    const rows = await this.db`
      select id, name, description, price, duration_minutes, active, sort_order
      from public.business_services where business_id = ${businessId}::uuid
      order by sort_order, created_at`;
    return rows.map((s) => ({
      id: s.id, name: s.name, description: s.description ?? '',
      price: s.price ?? '', durationMinutes: s.duration_minutes,
      active: s.active, sortOrder: s.sort_order,
    }));
  }

  async createBusinessService(user: AuthUser, businessId: string, dto: CreateBusinessServiceDto) {
    await this.requireOwnedBusiness(user, businessId);
    const rows = await this.db`
      insert into public.business_services (business_id, name, description, price, duration_minutes, sort_order)
      values (${businessId}::uuid, ${dto.name}, ${dto.description ?? null}, ${dto.price ?? null},
              ${dto.durationMinutes ?? null}, ${dto.sortOrder ?? 0})
      returning id`;
    return { serviceId: rows[0].id, created: true };
  }

  async updateBusinessService(user: AuthUser, businessId: string, serviceId: string, dto: UpdateBusinessServiceDto) {
    await this.requireNested(user, businessId, 'business_services', serviceId);
    const rows = await this.db`
      update public.business_services set
        name = coalesce(${dto.name ?? null}, name),
        description = coalesce(${dto.description ?? null}, description),
        price = coalesce(${dto.price ?? null}, price),
        duration_minutes = coalesce(${dto.durationMinutes ?? null}, duration_minutes),
        active = coalesce(${dto.active ?? null}, active),
        sort_order = coalesce(${dto.sortOrder ?? null}, sort_order),
        updated_at = now()
      where id = ${serviceId}::uuid
      returning id`;
    return { serviceId: rows[0].id, updated: true };
  }

  async deleteBusinessService(user: AuthUser, businessId: string, serviceId: string) {
    await this.requireNested(user, businessId, 'business_services', serviceId);
    await this.db`delete from public.business_services where id = ${serviceId}::uuid`;
    return { id: serviceId, deleted: true };
  }

  // ── type-specific extensions ──────────────────────────────────────────

  async updateDoctor(user: AuthUser, businessId: string, dto: UpdateDoctorDto) {
    const owned = await this.requireOwnedBusiness(user, businessId);
    await this.db`
      insert into public.doctors (business_id, name, specialization, qualification, experience_years, consultation_fee, bio)
      values (${businessId}::uuid, ${dto.name ?? String(owned.name)}, ${(dto.specialization ?? '') as string},
              ${(dto.qualification ?? null) as string | null}, ${(dto.experienceYears ?? null) as number | null}, ${(dto.consultationFee ?? null) as string | null}, ${(dto.bio ?? null) as string | null})
      on conflict (business_id) do update set
        name = coalesce(${dto.name ?? null}, public.doctors.name),
        specialization = coalesce(${dto.specialization ?? null}, public.doctors.specialization),
        qualification = coalesce(${dto.qualification ?? null}, public.doctors.qualification),
        experience_years = coalesce(${dto.experienceYears ?? null}, public.doctors.experience_years),
        consultation_fee = coalesce(${dto.consultationFee ?? null}, public.doctors.consultation_fee),
        bio = coalesce(${dto.bio ?? null}, public.doctors.bio),
        updated_at = now()`;
    return { updated: true };
  }

  async updateRestaurant(user: AuthUser, businessId: string, dto: UpdateRestaurantDto) {
    await this.requireOwnedBusiness(user, businessId);
    await this.db`
      insert into public.restaurants (business_id, cuisine, price_range, veg_type)
      values (${businessId}::uuid, ${dto.cuisine ?? ''}, ${dto.priceRange ?? ''}, ${dto.vegType ?? 'mixed'})
      on conflict (business_id) do update set
        cuisine = coalesce(${dto.cuisine ?? null}, public.restaurants.cuisine),
        price_range = coalesce(${dto.priceRange ?? null}, public.restaurants.price_range),
        veg_type = coalesce(${dto.vegType ?? null}, public.restaurants.veg_type),
        updated_at = now()`;
    return { updated: true };
  }

  async updateHotel(user: AuthUser, businessId: string, dto: UpdateHotelDto) {
    await this.requireOwnedBusiness(user, businessId);
    await this.db`
      insert into public.hotels (business_id, hotel_type, price_range, check_in, check_out)
      values (${businessId}::uuid, ${dto.hotelType ?? ''}, ${dto.priceRange ?? ''},
              ${dto.checkIn ?? null}, ${dto.checkOut ?? null})
      on conflict (business_id) do update set
        hotel_type = coalesce(${dto.hotelType ?? null}, public.hotels.hotel_type),
        price_range = coalesce(${dto.priceRange ?? null}, public.hotels.price_range),
        check_in = coalesce(${dto.checkIn ?? null}, public.hotels.check_in),
        check_out = coalesce(${dto.checkOut ?? null}, public.hotels.check_out),
        updated_at = now()`;
    return { updated: true };
  }

  async updateAmenities(user: AuthUser, businessId: string, dto: UpdateAmenitiesDto) {
    const owned = await this.requireOwnedBusiness(user, businessId);
    const hotel = await this.db`
      select id from public.hotels where business_id = ${businessId}::uuid`;
    let hotelId = (hotel[0]?.id ?? '') as string;
    if (!hotelId) {
      const created = await this.db`
        insert into public.hotels (business_id, hotel_type, price_range)
        values (${businessId}::uuid, '', '')
        on conflict (business_id) do update set updated_at = now()
        returning id`;
      hotelId = created[0].id as string;
    }
    await this.db.begin(async (txn) => {
      await txn`delete from public.hotel_amenities where hotel_id = ${hotelId}::uuid`;
      for (const amenity of dto.amenities) {
        await txn`
          insert into public.hotel_amenities (hotel_id, amenity)
          values (${hotelId}::uuid, ${amenity})`;
      }
    });
    return { amenities: dto.amenities, updated: true };
  }

  // ── images ────────────────────────────────────────────────────────────

  async setImagePrimary(user: AuthUser, businessId: string, imageId: string) {
    await this.requireNested(user, businessId, 'business_images', imageId);
    await this.db`update public.business_images set is_primary = false where business_id = ${businessId}::uuid`;
    await this.db`update public.business_images set is_primary = true where id = ${imageId}::uuid`;
    return { imageId, isPrimary: true };
  }

  // ── reviews (read-only for owners) ────────────────────────────────────

  async listReviews(user: AuthUser, businessId: string, limit = 50, offset = 0) {
    await this.requireOwnedBusiness(user, businessId);
    const [rows, count] = await Promise.all([
      this.db`
        select r.rating, r.comment, r.created_at, u.name as author
        from public.reviews r
        left join public.users u on u.id = r.user_id
        where r.business_id = ${businessId}::uuid
        order by r.created_at desc
        limit ${limit} offset ${offset}`,
      this.db`select count(*)::int as n from public.reviews where business_id = ${businessId}::uuid`,
    ]);
    return {
      total: count[0].n,
      reviews: rows.map((r) => ({
        rating: Number(r.rating),
        comment: r.comment ?? '',
        author: r.author ?? 'CityBee user',
        createdAt: r.created_at,
      })),
    };
  }
}
