-- 0008: services table — Indian-market home services (electrician, plumber,
-- carpenter, mechanic, painter, …) served to the Flutter Services tab via
-- GET /services. City-scoped like businesses; public read via RLS.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text,                          -- electrician|plumber|carpenter|ac-fridge|mechanic|painter|cleaning|pest|occasions|legal (null = general)
  badge text not null default '',
  rating text not null default '4.5',
  services_summary text not null default '',
  price_text text not null default '',
  eta_text text not null default '',
  stats_text text not null default '',
  trust_note text not null default '',
  image_url text not null default '',
  action_label text not null default 'Call Now',
  phone text not null default '',
  city_id uuid references public.cities(id) on delete cascade,
  is_city_specialty boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_city_idx on public.services(city_id);
create index if not exists services_category_idx on public.services(category);
create index if not exists services_active_idx on public.services(is_active) where is_active;

create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();

alter table public.services enable row level security;

create policy services_public_read on public.services
  for select to anon, authenticated using (is_active or true);
