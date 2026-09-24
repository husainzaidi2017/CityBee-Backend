# yello.ae → CityBee import pipeline

Pulls UAE business listings from [yello.ae](https://www.yello.ae) (UAE business
directory) into CityBee as **approved** businesses with city, area, phone,
rating and map coordinates.

## Pipeline

```
scrape-listings.py   →  listings.jsonl        (raw directory listings)
map-to-citybee.py    →  citybee_rows.jsonl    (CityBee-shaped rows)
import-rows.mjs      →  Supabase public.businesses + business_categories
```

### 1. Scrape

```bash
python scrape-listings.py --list                    # mapped category groups
python scrape-listings.py --all --delay 0.9         # all groups (resumable)
python scrape-listings.py --group hotels --max-pages 2   # test run
```

* robots.txt allows `/category/` and `/company/` for `User-agent: *` — the crawl
  stays polite (one request at a time, ~1 s delay) and resumable (`state.json`
  records finished pages, `listings.jsonl` is append-only, dedup by company id).
* Group → CityBee kind/category mapping lives in `GROUPS` (restaurants, hotels,
  malls, gyms, salons, cafes, bars, doctors, shops).

### 2. Map

```bash
python map-to-citybee.py
```

* City: bold place name in the listing address → nearest UAE city by coords
  (≤ 90 km) → city name in address text → nearest city.
* Area (`locality`): last sane comma segment before the city, street/building
  fragments filtered out.
* Phone normalised to `+971 X XXX XXXX`.
* Tagline: yello's one-line descriptor (short factual phrase), fallback
  generated. **Description is generated** from structured facts — no prose is
  copied from yello detail pages.
* Slug: `slugify(name)`, collisions get `-<city>` / `-<n>` suffixes.
* `external_ref = yello:<company id>` — the dedup key for re-runs.

### 3. Import

```bash
export DATABASE_URL="postgresql://…"   # citybee_api connection string
node import-rows.mjs --dry             # plan only
node import-rows.mjs                   # insert (batches of 400)
```

* Skips rows whose `external_ref` already exists; `on conflict (slug) do nothing`
  protects against slug clashes. Safe to re-run after a new scrape.
* Sets `status = 'approved'`, `country = 'United Arab Emirates'`, PostGIS point
  from lat/lng, rating/review count, `is_verified`.
* Businesses are linked to their CityBee category (`restaurants`, `hotels`,
  `cafes`, `salons`, `gyms`, `bars`, `malls`, `doctors`, `shops`).

### Prerequisite: UAE cities

`public.cities` needs the UAE cities with coordinates (the app's city picker
reads them and counts businesses). Added via migration/seed:

| slug | name |
| --- | --- |
| dubai | Dubai |
| abu-dhabi | Abu Dhabi |
| sharjah | Sharjah |
| ajman | Ajman |
| ras-al-khaimah | Ras Al Khaimah |
| fujairah | Fujairah |
| umm-al-quwain | Umm Al Quwain |
| al-ain | Al Ain |

## Not imported (source doesn't expose it in listings)

* Images — listing pages carry a logo only; images left empty (the app renders
  its branded fallback). Can be filled later from Google Places.
* Website / opening hours — only on yello detail pages (one request per
  business); not part of this pass.
