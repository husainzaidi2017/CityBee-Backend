-- kind is now free-form: the API derives/accepts any kind and links the
-- category by plural rules (grocery → groceries). The whitelist CHECK
-- would reject new kinds (gym, grocery, boutique…) at insert time.
alter table public.businesses drop constraint businesses_kind_check;
