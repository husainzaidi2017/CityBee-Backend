import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { DATABASE } from '../database/database.module';
import type { Sql } from 'postgres';
import { AdminRoleGuard } from './admin-role.guard';

/**
 * Admin-only CRUD over every content entity — the CityBee web admin
 * panel calls these exclusively (the panel holds no Supabase service key
 * for writes; it authenticates with a user JWT and this guard enforces
 * role = 'admin').
 *
 * Design: a single allow-listed "table + column" map keeps this surface
 * small and auditable. Every write is parameterized via postgres.js.
 */

const ENTITY_TABLES = {
  businesses: 'businesses',
  offers: 'offers',
  places: 'places',
  categories: 'categories',
  cities: 'cities',
  users: 'users',
  reviews: 'reviews',
  notifications: 'notifications',
  'business-claims': 'business_claims',
  submissions: 'business_submissions',
} as const;

type EntityKey = keyof typeof ENTITY_TABLES;

// Columns each entity may have written via the admin panel (allow-list).
const WRITABLE_COLUMNS: Record<EntityKey, Set<string>> = {
  businesses: new Set([
    'name', 'slug', 'kind', 'tagline', 'description', 'phone', 'whatsapp',
    'email', 'website', 'address', 'locality', 'city_id', 'state_region',
    'country', 'postal_code', 'google_place_id', 'rating', 'review_count',
    'opening_hours', 'is_pure_veg', 'is_verified', 'is_featured', 'status',
    'owner_id', 'external_ref',
  ]),
  offers: new Set([
    'title', 'description', 'badge_text', 'subtitle', 'coupon_code',
    'category_tag', 'terms', 'discount_type', 'discount_value',
    'valid_from', 'valid_until', 'status', 'is_featured', 'business_id',
  ]),
  places: new Set([
    'name', 'slug', 'description', 'category_id', 'city_id', 'address',
    'locality', 'country', 'website', 'phone', 'rating', 'review_count',
    'is_featured', 'is_active', 'timings', 'entry_fee', 'google_place_id',
    'external_ref',
  ]),
  categories: new Set(['name', 'slug', 'description', 'icon', 'parent_id', 'sort_order', 'is_active']),
  cities: new Set(['name', 'slug', 'state_region', 'country', 'country_code', 'latitude', 'longitude', 'google_place_id', 'is_active']),
  users: new Set(['name', 'phone', 'email', 'profile_image_url', 'role', 'selected_city_id', 'is_active']),
  reviews: new Set(['rating', 'review_text', 'status']),
  notifications: new Set(['title', 'message', 'user_id', 'type', 'target_type', 'target_id', 'is_read']),
  'business-claims': new Set(['status', 'message']),
  submissions: new Set(['status', 'admin_note']),
};

const IDENT = /^[a-z_]+$/; // table/column identifiers only


function assertEntity(entity: string): EntityKey {
  if (!(entity in ENTITY_TABLES)) throw new BadRequestException(`Unknown entity "${entity}"`);
  return entity as EntityKey;
}

function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new BadRequestException('Invalid identifier');
  return `"${name}"`;
}


// JSON value → SQL-friendly primitive (arrays/objects → jsonb).
function toSqlValue(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminRoleGuard)
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  // ── List (paginated, optional search) ─────────────────────────────
  @Get(':entity')
  @ApiOperation({ summary: 'List rows of an entity (admin, paginated)' })
  async list(
    @Param('entity') entity: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
    @Query('q') q?: string,
    @Query('orderBy') orderBy = 'created_at',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    const key = assertEntity(entity);
    const table = quoteIdent(ENTITY_TABLES[key]);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const nameCol = quoteIdent(key === 'submissions' ? 'business_name' : 'name');

    const orderAllowed =
      WRITABLE_COLUMNS[key].has(orderBy) || orderBy === 'created_at' || orderBy === 'id';
    const safeOrder = quoteIdent(orderAllowed ? orderBy : 'created_at');
    const dir = order === 'asc' ? 'asc' : 'desc';

    const where = q ? `where ${nameCol} ilike $3` : '';
    const countParams = q ? ['%' + q + '%'] : [];
    const countWhere = q ? `where ${nameCol} ilike $1` : '';
    const offset = (pageNum - 1) * limitNum;

    // $1 limit, $2 offset, (optional $3 search) — count re-uses $1 for search.
    const params = q
      ? ['%' + q + '%', limitNum, offset]
      : [limitNum, offset];
    // Rearrange: search first when present for clarity.
    const query = q
      ? `select * from public.${table} where ${nameCol} ilike $1 order by ${safeOrder} ${dir} limit $2 offset $3`
      : `select * from public.${table} order by ${safeOrder} ${dir} limit $1 offset $2`;
    const rows = await this.db.unsafe(query, params);

    const countQuery = `select count(*)::int as count from public.${table} ${countWhere}`;
    const [{ count }] = await this.db.unsafe(countQuery, countParams);
    return { items: rows, total: count, page: pageNum, limit: limitNum };
  }

  // ── Get one ───────────────────────────────────────────────────────
  @Get(':entity/:id')
  @ApiOperation({ summary: 'Get one row by uuid' })
  async getOne(@Param('entity') entity: string, @Param('id', ParseUUIDPipe) id: string) {
    const key = assertEntity(entity);
    const table = quoteIdent(ENTITY_TABLES[key]);
    const rows = await this.db.unsafe(
      `select * from public.${table} where id = $1`, [id],
    );
    if (!rows.length) throw new NotFoundException('Not found');
    return rows[0];
  }

  // ── Create ─────────────────────────────────────────────────────────
  @Post(':entity')
  @ApiOperation({ summary: 'Create a row (allow-listed columns only)' })
  async create(@Param('entity') entity: string, @Body() body: Record<string, unknown>) {
    const key = assertEntity(entity);
    const entries = this.filterColumns(key, body);
    if (entries.length === 0) throw new BadRequestException('No valid columns provided');

    const cols = entries.map(([c]) => quoteIdent(c));
    const placeholders = entries.map((_, i) => `$${i + 1}`);
    const values: unknown[] = entries.map(([, v]) => toSqlValue(v));
    const table = quoteIdent(ENTITY_TABLES[key]);
    const rows = await this.db.unsafe(
      `insert into public.${table} (${cols.join(', ')}) values (${placeholders.join(', ')}) returning *`,
      values as never[],
    );
    return rows[0];
  }

  // ── Update ─────────────────────────────────────────────────────────
  @Patch(':entity/:id')
  @ApiOperation({ summary: 'Update a row (allow-listed columns only)' })
  async update(
    @Param('entity') entity: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const key = assertEntity(entity);
    const entries = this.filterColumns(key, body);
    if (entries.length === 0) throw new BadRequestException('No valid columns provided');

    const sets = entries.map(([c], i) => `${quoteIdent(c)} = $${i + 1}`);
    const values: unknown[] = entries.map(([, v]) => toSqlValue(v));
    values.push(id);
    const table = quoteIdent(ENTITY_TABLES[key]);
    const rows = await this.db.unsafe(
      `update public.${table} set ${sets.join(', ')} where id = $${entries.length + 1} returning *`,
      values as never[],
    );
    if (!rows.length) throw new NotFoundException('Not found');
    return rows[0];
  }

  // ── Delete ─────────────────────────────────────────────────────────
  @Delete(':entity/:id')
  @ApiOperation({ summary: 'Delete a row' })
  async remove(@Param('entity') entity: string, @Param('id', ParseUUIDPipe) id: string) {
    const key = assertEntity(entity);
    const table = quoteIdent(ENTITY_TABLES[key]);
    // users: never hard-delete auth users — deactivate instead.
    if (key === 'users') {
      const rows = await this.db.unsafe(
        'update public.users set is_active = false, updated_at = now() where id = $1 returning id',
        [id],
      );
      if (!rows.length) throw new NotFoundException('Not found');
      return { id, deactivated: true };
    }
    const rows = await this.db.unsafe(
      `delete from public.${table} where id = $1 returning id`, [id],
    );
    if (!rows.length) throw new NotFoundException('Not found');
    return { id, deleted: true };
  }

  // ── helpers ────────────────────────────────────────────────────────
  private filterColumns(entity: EntityKey, body: Record<string, unknown>): [string, unknown][] {
    const allowed = WRITABLE_COLUMNS[entity];
    const entries: [string, unknown][] = [];
    for (const [col, value] of Object.entries(body)) {
      if (allowed.has(col) && value !== undefined) {
        entries.push([col, value]);
      }
    }
    return entries;
  }
}
