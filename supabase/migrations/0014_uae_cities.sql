-- UAE cities for the yello.ae import (see supabase/scripts/yello-import).
-- The app city picker lists cities ordered by approved business count, so these
-- surface automatically once the imported businesses land.
insert into public.cities (slug, name, state_region, country, country_code, latitude, longitude)
values
  ('dubai',          'Dubai',          'Dubai',          'United Arab Emirates', 'AE', 25.2048493, 55.2707828),
  ('abu-dhabi',      'Abu Dhabi',      'Abu Dhabi',      'United Arab Emirates', 'AE', 24.453884,  54.3773438),
  ('sharjah',        'Sharjah',        'Sharjah',        'United Arab Emirates', 'AE', 25.3462553, 55.4209317),
  ('ajman',          'Ajman',          'Ajman',          'United Arab Emirates', 'AE', 25.4052165, 55.5136433),
  ('ras-al-khaimah', 'Ras Al Khaimah', 'Ras Al Khaimah', 'United Arab Emirates', 'AE', 25.8006926, 55.9761994),
  ('fujairah',       'Fujairah',       'Fujairah',       'United Arab Emirates', 'AE', 25.1288099, 56.3264849),
  ('umm-al-quwain',  'Umm Al Quwain',  'Umm Al Quwain',  'United Arab Emirates', 'AE', 25.56473,   55.55517),
  ('al-ain',         'Al Ain',         'Abu Dhabi',      'United Arab Emirates', 'AE', 24.130162,  55.802312)
on conflict (slug) do update set
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  country = excluded.country,
  country_code = excluded.country_code;
