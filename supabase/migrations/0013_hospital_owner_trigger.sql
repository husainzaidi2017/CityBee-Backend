-- 0013: Hospital category + owner-assignment safety trigger.

insert into public.categories (name, slug, default_kind, sort_order, is_active)
values ('Hospital', 'hospital', 'hospital', 5, true)
on conflict (slug) do update set is_active = true, default_kind = 'hospital';

-- Safety net: whenever a submission flips to approved, its business gets the
-- submitter as owner — no matter which path approved it (backend API or
-- admin-panel direct write). Fixes owner_id missing on approve.
create or replace function public.set_business_owner_from_submission()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and new.submitter_user_id is not null then
    update public.businesses b
    set owner_id = new.submitter_user_id
    where lower(b.name) = lower(new.business_name)
      and (b.owner_id is null or b.owner_id <> new.submitter_user_id);
  end if;
  return new;
end; $$;

drop trigger if exists submission_approved_owner on public.business_submissions;
create trigger submission_approved_owner
  after update of status on public.business_submissions
  for each row execute function public.set_business_owner_from_submission();
