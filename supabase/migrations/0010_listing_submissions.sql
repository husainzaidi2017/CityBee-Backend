-- 0010: List-Your-Business (Flutter) — extends the EXISTING
-- business_submissions approval pipeline with owner linkage and review
-- metadata. The admin panel already lists/approves this table.

alter table public.business_submissions
  add column if not exists submitter_user_id uuid references public.users(id) on delete set null,
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz not null default now();

create index if not exists business_submissions_submitter_idx
  on public.business_submissions(submitter_user_id);
create index if not exists business_submissions_status_idx
  on public.business_submissions(status) where status = 'pending';

-- Backfill submitted_at for legacy rows.
update public.business_submissions
  set submitted_at = created_at
  where submitted_at is null or submitted_at = created_at;
