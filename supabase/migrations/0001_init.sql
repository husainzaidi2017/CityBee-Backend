-- CityBee initial schema — Phase 1/2 (tables, relationships, PostGIS, indexes)
-- Project: uqjhuiylvfafuqehuzwm  Applied via Supabase MCP apply_migration
-- All ids are UUID; public stable ids exposed to Flutter are slugs.

create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ── shared updated_at trigger function ───────────────────────────────────
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
  begin
    new.updated_at = now();
    return new;
  end;
  $$;

-- ── cities ───────────────────────────────────────────────────────────────
-- Dynamically cached from Google Places selection — no master world list.
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  state_region text,
  country text not null default '',
  country_code char(2),
  latitude double precision not null,
  longitude double precision not null,
  google_place_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.cities
  for each row execute function public.set_updated_at();

-- ── users ────────────────────────────────────────────────────────────────
-- Mirror of Supabase Auth users (id = auth.users.id). No credentials here.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text,
  email text,
  profile_image_url text,
  role text not null default 'user'
    check (role in ('user', 'business_owner', 'admin')),
  selected_city_id uuid references public.cities(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add constraint users_email_key unique (email) deferrable initially deferred;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ── categories ───────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_parent_idx on public.categories(parent_id);
create index categories_sort_idx on public.categories(sort_order);

create trigger set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ── businesses ───────────────────────────────────────────────────────────
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.users(id) on delete set null,
  name text not null,
  slug text unique,
  kind text not null default 'service'
    check (kind in ('restaurant','doctor','hotel','salon','shop','mall','service')),
  tagline text not null default '',
  description text not null default '',
  phone text,
  whatsapp text,
  email text,
  website text,
  address text not null default '',
  locality text,
  city_id uuid references public.cities(id) on delete set null,
  state_region text,
  country text not null default 'India',
  postal_code text,
  location geography(point, 4326),
  google_place_id text,
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count int not null default 0,
  opening_hours text,
  is_pure_veg boolean not null default false,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','inactive')),
  external_ref text,  -- stable id for bulk import dedup
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

create index businesses_city_idx on public.businesses(city_id);
create index businesses_status_idx on public.businesses(status) where status = 'approved';
create index businesses_featured_idx on public.businesses(is_featured) where is_featured;
create index businesses_kind_idx on public.businesses(kind);
create index businesses_location_idx on public.businesses using gist (location);
create index businesses_name_trgm_idx on public.businesses using gin (name gin_trgm_ops);
create index businesses_extref_idx on public.businesses(external_ref);
create index businesses_owner_idx on public.businesses(owner_id);

-- ── business_categories (m:n) ────────────────────────────────────────────
create table public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (business_id, category_id)
);

create index business_categories_cat_idx on public.business_categories(category_id);

-- ── business_images ──────────────────────────────────────────────────────
-- image_url/public_id point at Cloudinary; no binaries in Postgres.
create table public.business_images (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  image_url text not null,
  public_id text,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index business_images_biz_idx on public.business_images(business_id, sort_order);

-- ── offers ───────────────────────────────────────────────────────────────
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text not null default '',
  badge_text text not null default '',
  subtitle text not null default '',
  coupon_code text,
  category_tag text not null default 'All',
  terms text,
  discount_type text check (discount_type in ('percent','flat','bogo','other')),
  discount_value numeric(10,2),
  valid_from date,
  valid_until date,
  status text not null default 'draft'
    check (status in ('draft','pending','active','expired','rejected','inactive')),
  is_featured boolean not null default false,
  views int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

create index offers_business_idx on public.offers(business_id);
create index offers_status_idx on public.offers(status) where status = 'active';
create index offers_tag_idx on public.offers(category_tag);
create index offers_valid_idx on public.offers(valid_until);

-- ── offer_images ─────────────────────────────────────────────────────────
create table public.offer_images (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  image_url text not null,
  public_id text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index offer_images_offer_idx on public.offer_images(offer_id, sort_order);

-- ── doctors (business extension) ─────────────────────────────────────────
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  name text not null,
  specialization text not null default '',
  qualification text,
  experience_years int check (experience_years >= 0),
  consultation_fee text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index doctors_spec_trgm_idx on public.doctors using gin (specialization gin_trgm_ops);
create trigger set_updated_at before update on public.doctors
  for each row execute function public.set_updated_at();

-- ── restaurants (business extension) ─────────────────────────────────────
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  cuisine text,
  price_range text,
  veg_type text check (veg_type in ('veg','non_veg','mixed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

-- ── hotels (business extension) ──────────────────────────────────────────
create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  hotel_type text,
  price_range text,
  check_in time,
  check_out time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.hotels
  for each row execute function public.set_updated_at();

create table public.hotel_amenities (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  amenity text not null,
  primary key (hotel_id, amenity)
);

-- ── places (tourist/heritage POIs) ───────────────────────────────────────
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  city_id uuid references public.cities(id) on delete set null,
  address text,
  locality text,
  country text,
  location geography(point, 4326),
  google_place_id text,
  website text,
  phone text,
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count int not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  timings text,
  entry_fee text,
  external_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.places
  for each row execute function public.set_updated_at();

create index places_city_idx on public.places(city_id);
create index places_location_idx on public.places using gist (location);
create index places_active_idx on public.places(is_active) where is_active;
create index places_extref_idx on public.places(external_ref);

-- ── place_images ─────────────────────────────────────────────────────────
create table public.place_images (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  image_url text not null,
  public_id text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index place_images_place_idx on public.place_images(place_id, sort_order);

-- ── menu_items (dishes on restaurant business detail) ────────────────────
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price text,
  image_url text,
  is_veg boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index menu_items_biz_idx on public.menu_items(business_id, sort_order);

-- ── favorites (one non-null target, duplicates prevented) ────────────────
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  offer_id uuid references public.offers(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_one_target check (
    (num_nonnulls(business_id, offer_id, place_id) = 1)
  ),
  constraint favorites_unique_business unique (user_id, business_id),
  constraint favorites_unique_offer unique (user_id, offer_id),
  constraint favorites_unique_place unique (user_id, place_id)
);

create index favorites_user_idx on public.favorites(user_id);

-- ── reviews ──────────────────────────────────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  review_text text,
  status text not null default 'approved'
    check (status in ('pending','approved','rejected')),
  constraint reviews_one_target check (
    (num_nonnulls(business_id, place_id) = 1)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();
create index reviews_business_idx on public.reviews(business_id);
create index reviews_place_idx on public.reviews(place_id);
create index reviews_user_idx on public.reviews(user_id);
-- One review per user per target.
create unique index reviews_unique_business on public.reviews(user_id, business_id) where business_id is not null;
create unique index reviews_unique_place on public.reviews(user_id, place_id) where place_id is not null;

-- ── notifications ────────────────────────────────────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,  -- null = broadcast
  title text not null,
  message text not null,
  type text not null default 'general',
  target_type text check (target_type in ('business','offer','place','offers_tab','explore_tab','more_tab')),
  target_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications(user_id, is_read);

-- ── business_claims ──────────────────────────────────────────────────────
create table public.business_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create trigger set_updated_at before update on public.business_claims
  for each row execute function public.set_updated_at();

-- Enable Row Level Security on all tables (policies arrive in 0002).
alter table public.users enable row level security;
alter table public.cities enable row level security;
alter table public.categories enable row level security;
alter table public.businesses enable row level security;
alter table public.business_categories enable row level security;
alter table public.business_images enable row level security;
alter table public.offers enable row level security;
alter table public.offer_images enable row level security;
alter table public.doctors enable row level security;
alter table public.restaurants enable row level security;
alter table public.hotels enable row level security;
alter table public.hotel_amenities enable row level security;
alter table public.places enable row level security;
alter table public.place_images enable row level security;
alter table public.menu_items enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.business_claims enable row level security;
