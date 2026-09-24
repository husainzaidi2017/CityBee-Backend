// Import mapped yello.ae rows into Supabase:
//   public.businesses (+ public.business_categories link)
//
// Reads rows from citybee_rows.jsonl (see map-to-citybee.py), dedups on
// external_ref ("yello:<company id>") and lets the unique slug index skip
// anything already present — re-runs are safe.
//
//   DATABASE_URL="postgresql://..." node import-rows.mjs --dry
//   DATABASE_URL="postgresql://..." node import-rows.mjs
//   DATABASE_URL="postgresql://..." node import-rows.mjs --limit 500
//
// Only citybee_api DB connection string is needed (same value the backend
// uses as DATABASE_URL). Never commit it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const IN = process.env.ROWS_FILE ?? path.join(HERE, 'citybee_rows.jsonl');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required (postgres connection string).');
  process.exit(1);
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const limitArg = args.indexOf('--limit');
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

const sql = postgres(url, { ssl: 'require', max: 3, idle_timeout: 20 });

const rows = fs
  .readFileSync(IN, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .slice(0, limit === Infinity ? undefined : limit);

console.log(`rows in file: ${rows.length}`);

const existing = new Set(
  (
    await sql`select external_ref from public.businesses where external_ref like 'yello:%'`
  ).map((r) => r.external_ref),
);
console.log(`already imported: ${existing.size}`);

const todo = rows.filter((r) => !existing.has(r.ext_ref));
console.log(`to import: ${todo.length}`);
if (dry || todo.length === 0) {
  await sql.end();
  process.exit(0);
}

const BATCH = 400;
let inserted = 0;
let skipped = 0;

for (let i = 0; i < todo.length; i += BATCH) {
  const batch = todo.slice(i, i + BATCH);
  const payload = sql.json(
    batch.map((r) => ({
      slug: r.slug,
      name: r.name,
      kind: r.kind,
      tagline: r.tagline,
      description: r.description,
      phone: r.phone,
      address: r.address,
      locality: r.locality,
      city_slug: r.city_slug,
      lat: r.lat,
      lng: r.lng,
      rating: r.rating,
      reviews: r.reviews,
      verified: r.verified,
      ext_ref: r.ext_ref,
    })),
  );

  const made = await sql`
    with v as (
      select * from jsonb_to_recordset(${payload}) as x(
        slug text, name text, kind text, tagline text, description text, phone text,
        address text, locality text, city_slug text, lat float8, lng float8,
        rating numeric, reviews int, verified boolean, ext_ref text
      )
    )
    insert into public.businesses
      (slug, name, kind, tagline, description, phone, address, locality,
       city_id, country, location, rating, review_count, is_verified, status,
       external_ref, created_at, updated_at)
    select v.slug, v.name, v.kind, v.tagline, v.description, v.phone, v.address, v.locality,
           c.id, 'United Arab Emirates',
           case when v.lat is not null and v.lng is not null
                then st_setsrid(st_makepoint(v.lng, v.lat), 4326)::geography end,
           coalesce(v.rating, 0), coalesce(v.reviews, 0), coalesce(v.verified, false),
           'approved', v.ext_ref, now(), now()
    from v left join public.cities c on c.slug = v.city_slug
    on conflict (slug) do nothing
    returning id, external_ref`;

  inserted += made.length;
  skipped += batch.length - made.length;

  if ((i / BATCH) % 5 === 0 || i + BATCH >= todo.length) {
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} — inserted ${inserted}, slug-skipped ${skipped}`);
  }
}

// Category links (single pass at the end — every imported row gets its category).
const catMap = sql.json(todo.map((r) => ({ ext_ref: r.ext_ref, category: r.category })));
await sql`
  with m as (
    select * from jsonb_to_recordset(${catMap}) as x(ext_ref text, category text)
  )
  insert into public.business_categories (business_id, category_id)
  select b.id, c.id
  from m
  join public.businesses b on b.external_ref = m.ext_ref
  join public.categories c on c.slug = m.category
  on conflict do nothing`;

const [{ count }] = await sql`select count(*)::int from public.businesses where external_ref like 'yello:%'`;
console.log(`DONE — inserted ${inserted}, slug-skipped ${skipped}, total yello businesses now ${count}`);
await sql.end();
