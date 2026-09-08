-- City display fields used by the location header / city picker.
alter table public.cities
  add column if not exists nickname text not null default '',
  add column if not exists default_area text not null default '';

update public.cities set nickname = 'Peetal Nagri', default_area = 'Civil Lines, Moradabad' where slug = 'moradabad';
update public.cities set nickname = 'Nath Nagri', default_area = 'Cantt, Bareilly' where slug = 'bareilly';
update public.cities set nickname = 'City of Libraries', default_area = 'Civil Lines, Rampur' where slug = 'rampur';
