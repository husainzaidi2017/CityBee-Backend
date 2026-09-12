-- 0011: Category-driven business kind.
-- Each category declares the business kind its listings get by default.
-- New categories created later simply set default_kind — the backend reads
-- it at submission time, so no hardcoded slug maps can drift again.

alter table public.categories
  add column if not exists default_kind text not null default 'service';

-- Backfill from the current slugs.
update public.categories set default_kind = 'doctor'
  where slug in ('doctors', 'doctor');
update public.categories set default_kind = 'restaurant'
  where slug in ('restaurants', 'restaurant', 'dining');
update public.categories set default_kind = 'hotel'
  where slug in ('hotels', 'hotel');
update public.categories set default_kind = 'salon'
  where slug in ('salons', 'salon', 'barber', 'barbers');
update public.categories set default_kind = 'mall'
  where slug in ('malls', 'mall');
update public.categories set default_kind = 'shop'
  where slug in ('shops', 'shop', 'fashion', 'grocery', 'groceries', 'heritage', 'heritages');
-- everything else (cinemas, gyms, …) keeps the column default 'service'
