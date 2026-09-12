-- New categories (gyms, bars, cafes) derive kinds gym/bar/cafe, which the
-- original business_submissions.kind whitelist rejects — user submissions
-- for those categories failed with a 500. Extend the allowed kinds to
-- every current categories.default_kind (+ legacy service/fashion/grocery).
begin;

alter table public.business_submissions drop constraint business_submissions_kind_check;

alter table public.business_submissions add constraint business_submissions_kind_check
  check (kind = any (array[
    'restaurant', 'doctor', 'hotel', 'salon', 'shop', 'mall', 'service',
    'gym', 'bar', 'cafe', 'cinema', 'heritage', 'fashion', 'grocery'
  ]));

commit;
