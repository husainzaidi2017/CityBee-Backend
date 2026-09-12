-- 0012: category tuning per business request.
--  - kinds: heritage/cinema/gym get their own kind values
--  - barber category removed (businesses relinked to salons)
--  - new categories: gyms, bars, cafes

-- ── kind corrections ──────────────────────────────────────────────────
update public.categories set default_kind = 'heritage' where slug in ('heritage', 'heritages');
update public.categories set default_kind = 'cinema'   where slug in ('cinema', 'cinemas');
update public.categories set default_kind = 'gym'      where slug in ('gym', 'gyms');

-- Existing businesses: fix kinds to match (approved/live records).
update public.businesses b
  set kind = 'heritage'
  where b.id in (
    select bc.business_id from public.business_categories bc
    join public.categories c on c.id = bc.category_id
    where c.slug in ('heritage', 'heritages'));
update public.businesses b
  set kind = 'cinema'
  where b.id in (
    select bc.business_id from public.business_categories bc
    join public.categories c on c.id = bc.category_id
    where c.slug in ('cinema', 'cinemas'));

-- ── remove barber category: relink its businesses to salons ───────────
update public.business_categories
  set category_id = (select id from public.categories where slug = 'salons')
  where category_id = (select id from public.categories where slug = 'barber');

delete from public.categories where slug = 'barber';

-- ── new categories ────────────────────────────────────────────────────
insert into public.categories (name, slug, default_kind, sort_order, is_active)
values
  ('Gyms',  'gyms',  'gym',    12, true),
  ('Bars',  'bars',  'bar',    13, true),
  ('Cafes', 'cafes', 'cafe',   14, true)
on conflict (slug) do update
  set default_kind = excluded.default_kind, is_active = true;

-- The legacy 'gym' row (singular) is superseded by the new 'gyms' row —
-- relink anything on it and deactivate it.
update public.business_categories
  set category_id = (select id from public.categories where slug = 'gyms')
  where category_id = (select id from public.categories where slug = 'gym');
update public.categories set is_active = false where slug = 'gym';
