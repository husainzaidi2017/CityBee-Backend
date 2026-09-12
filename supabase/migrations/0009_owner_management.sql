-- 0009: Business-owner management system.
--  - business_hours (normalized per-day hours)
--  - business_services (salon/barber/repair service lists)
--  - menu_categories + menu_items extensions (category, availability)
--  - businesses.rejection_reason + wider lifecycle statuses
--  - RLS: public reads approved listings; owners manage their own rows.

-- ── business_hours ───────────────────────────────────────────────────────
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  is_closed boolean not null default false,
  open_time time not null default '09:00',
  close_time time not null default '21:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, day_of_week)
);

create index if not exists business_hours_biz_idx on public.business_hours(business_id);
create trigger set_updated_at before update on public.business_hours
  for each row execute function public.set_updated_at();

-- ── business_services ────────────────────────────────────────────────────
create table if not exists public.business_services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price text,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_services_biz_idx on public.business_services(business_id);
create trigger set_updated_at before update on public.business_services
  for each row execute function public.set_updated_at();

-- ── menu_categories ──────────────────────────────────────────────────────
create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists menu_categories_biz_idx on public.menu_categories(business_id);
create trigger set_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();

-- ── menu_items extensions ────────────────────────────────────────────────
alter table public.menu_items
  add column if not exists menu_category_id uuid references public.menu_categories(id) on delete set null,
  add column if not exists available boolean not null default true,
  add column if not exists image_public_id text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists menu_items_category_idx on public.menu_items(menu_category_id);
create trigger set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ── businesses: rejection reason + full lifecycle statuses ───────────────
alter table public.businesses add column if not exists rejection_reason text;

alter table public.businesses drop constraint if exists businesses_status_check;
alter table public.businesses add constraint businesses_status_check
  check (status in ('draft', 'pending', 'approved', 'rejected', 'inactive', 'suspended'));

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Public reads rows whose parent business is approved; owners and admins
-- (via is_admin()) manage their own. Writes in practice flow through the
-- NestJS API (service-role connection); these policies protect direct access.

alter table public.business_hours enable row level security;
drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours
  for select to anon, authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.status = 'approved'));
drop policy if exists business_hours_owner_all on public.business_hours;
create policy business_hours_owner_all on public.business_hours
  for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())));

alter table public.business_services enable row level security;
drop policy if exists business_services_public_read on public.business_services;
create policy business_services_public_read on public.business_services
  for select to anon, authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.status = 'approved'));
drop policy if exists business_services_owner_all on public.business_services;
create policy business_services_owner_all on public.business_services
  for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())));

alter table public.menu_categories enable row level security;
drop policy if exists menu_categories_public_read on public.menu_categories;
create policy menu_categories_public_read on public.menu_categories
  for select to anon, authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id and b.status = 'approved'));
drop policy if exists menu_categories_owner_all on public.menu_categories;
create policy menu_categories_owner_all on public.menu_categories
  for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())));

-- menu_items: keep existing public read; add owner write policy.
drop policy if exists menu_items_owner_all on public.menu_items;
create policy menu_items_owner_all on public.menu_items
  for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.businesses b
                 where b.id = business_id
                   and (b.owner_id = auth.uid() or public.is_admin())));
