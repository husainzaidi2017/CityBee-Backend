-- business_submissions.kind had a 7-value whitelist left over from the
-- original schema; new categories (gyms/bars/cafes at first, and any
-- future category with a new default_kind) failed submissions with a 500.
-- The businesses table already dropped its kind check (see 0001-era
-- change + e1f6f7d); the submission table now matches — kind is derived
-- server-side from the category, so a DB whitelist serves no purpose.
begin;

alter table public.business_submissions drop constraint business_submissions_kind_check;

commit;
