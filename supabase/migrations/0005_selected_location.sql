-- CityBee location architecture refactor (Phase 5)
--
-- 1. User-selected Google location is stored on the user, NOT as a cities row.
-- 2. cities stays CityBee reference data; google_place_id becomes unique.

alter table public.users
  add column if not exists selected_location_name text,
  add column if not exists selected_location_lat double precision,
  add column if not exists selected_location_lng double precision,
  add column if not exists selected_location_google_place_id text,
  add column if not exists selected_location_country text,
  add column if not exists selected_location_country_code text,
  add column if not exists selected_location_state text,
  add column if not exists selected_location_locality text;

-- Unique google_place_id on cities (verified: no duplicates in existing data;
-- partial index keeps NULLs — legacy city rows without a place id — legal).
create unique index if not exists cities_google_place_id_uidx
  on public.cities (google_place_id)
  where google_place_id is not null;

-- Safety for any future city upsert: conflicting place ids are updated,
-- never duplicated (ON CONFLICT ... DO UPDATE).
