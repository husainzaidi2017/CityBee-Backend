-- CityBee image-system hardening (spec: max 5 images/business, single
-- primary, no duplicate Cloudinary assets, place-id dedup for imports).

-- 1. At most 5 images per business, enforced in the DATABASE (a 6th insert
--    fails regardless of which client attempts it).
create or replace function public.business_images_max_five() returns trigger
  language plpgsql as $$
begin
  if (select count(*) from public.business_images where business_id = new.business_id) >= 5 then
    raise exception 'BUSINESS_IMAGE_LIMIT_REACHED'
      using errcode = 'P0003';
  end if;
  return new;
end;
$$;

drop trigger if exists business_images_max_five_trg on public.business_images;
create trigger business_images_max_five_trg
  before insert on public.business_images
  for each row execute function public.business_images_max_five();

-- 2. At most ONE primary image per business (partial unique index).
create unique index if not exists business_images_one_primary
  on public.business_images (business_id)
  where is_primary;

-- 3. The same Cloudinary asset can only be linked once (per table).
create unique index if not exists business_images_public_id_uidx
  on public.business_images (public_id)
  where public_id is not null;

-- 4. Import dedup: one business per Google Place ID (partial — legacy
--    rows without a place id stay legal).
create unique index if not exists businesses_google_place_id_uidx
  on public.businesses (google_place_id)
  where google_place_id is not null;

-- Same protections for offer/place images (consistency, 5-image cap is
-- business-specific per spec; offers/places keep single-primary + dedup).
create unique index if not exists offer_images_one_primary
  on public.offer_images (offer_id) where is_primary;
create unique index if not exists offer_images_public_id_uidx
  on public.offer_images (public_id) where public_id is not null;
create unique index if not exists place_images_one_primary
  on public.place_images (place_id) where is_primary;
create unique index if not exists place_images_public_id_uidx
  on public.place_images (public_id) where public_id is not null;
