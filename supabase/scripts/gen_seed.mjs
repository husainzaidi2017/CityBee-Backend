// Generates supabase/migrations/0003_seed.sql from the Flutter mock data
// plus the Cloudinary URLs captured in seed-images.json.
import { readFileSync, writeFileSync } from 'node:fs';

const img = JSON.parse(readFileSync('D:/CityBee/city-bee-backend/seed-images.json', 'utf8'));

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const pt = (lat, lng) => `st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`;
const rows = (arr) => arr.map((r) => `(${r.join(', ')})`).join(',\n  ');

const cities = [
  ['moradabad', 'Moradabad', 'Uttar Pradesh', 28.8386, 78.7733],
  ['bareilly', 'Bareilly', 'Uttar Pradesh', 28.367, 79.4305],
  ['rampur', 'Rampur', 'Uttar Pradesh', 28.8082, 79.0253],
].map(([slug, name, state, lat, lng]) => [q(slug), q(name), q(state), q('India'), q('IN'), lat, lng]);

const categories = [
  ['fashion', 'Fashion', 1], ['grocery', 'Grocery', 2], ['dining', 'Food & Dining', 3],
  ['doctors', 'Doctors', 4], ['hotels', 'Hotels', 5], ['barbers', 'Barbers', 6],
  ['heritage', 'Heritage', 7], ['salons', 'Salons', 8], ['malls', 'Malls', 9], ['cinemas', 'Cinemas', 10],
].map(([slug, name, sort]) => [q(name), q(slug), sort]);

// slug, name, kind, catSlug, tagline, desc, phone, whatsapp, address, locality, lat, lng, rating, rcount, hours, verified, pureVeg, featured, website
const biz = [
  ['royal-mughal', 'Royal Restaurant & Banquet', 'restaurant', 'dining', 'Mughlai · Awadhi · North Indian', 'A Moradabad landmark for Mughlai dining and grand banquets. Family dining hall, pure-veg kitchen and up to 300-pax banquet space.', '+915912400161', '919876543210', '16B, Delhi Road, Near Majhola Chauraha, Civil Lines, Moradabad, UP 248001', 'Civil Lines, Moradabad', 28.8371, 78.7759, 4.6, 1240, '11:00 AM – 11:30 PM', true, false, true, null],
  ['peeli-batti-biryani', 'Peeli Batti Biryani House', 'restaurant', 'dining', 'Biryani · Kebab · Rolls', 'Slow-cooked Moradabadi biryani served late into the night at Peeli Batti.', '+915912400282', '919812345678', 'Peeli Batti Chowk, Budh Bazaar, Moradabad', 'Budh Bazaar', 28.8291, 78.7712, 4.3, 860, '12:00 PM – 1:00 AM', true, false, false, null],
  ['brass-cafe', 'The Brass Cafe', 'restaurant', 'dining', 'Cafe · Continental · Fast Food', 'Brass-themed cafe serving coffee, shakes and continental snacks.', '+915912400393', '919876543210', 'Shop 7, Cantonment Road, Civil Lines, Moradabad', 'Civil Lines', 28.842, 78.7701, 4.5, 412, 'Opens at 11:00 AM', true, true, false, null],
  ['mughal-dastarkhwan', 'Mughal Dastarkhwan', 'restaurant', 'dining', 'Mughlai · Family Dining', 'Traditional dastarkhwan dining with Awadhi delicacies.', '+915912400474', '919876543210', 'Delhi Road, Opp. Transport Nagar, Moradabad', 'Delhi Road', 28.848, 78.781, 4.2, 530, '11:30 AM – 11:00 PM', false, false, false, null],
  ['verma-dental', 'Dr. Verma Dental Clinic', 'doctor', 'doctors', 'Dentist · BDS, MDS (Prosthodontics)', 'Painless dentistry — cleaning, fillings, braces and implants. Walk-ins welcome, first consultation discounted via CityBee.', '+915912400585', '919812345678', '1st Floor, Harvard Tower, Court Road, Moradabad', 'Court Road', 28.8388, 78.7769, 4.8, 490, 'Mon–Sat · 10:00 AM – 2:00 PM, 5:00 – 8:30 PM', true, true, false, null],
  ['trends-n-threads', 'Trends N Threads Boutique', 'shop', 'fashion', 'Boutique · Designer Wear · Alterations', 'Designer suits, lehengas and bespoke tailoring by local craftsmen.', '+915912400696', '919876543210', 'B-14, Subhash Nagar, Moradabad', 'Subhash Nagar', 28.8221, 78.7768, 4.4, 320, '10:30 AM – 8:30 PM', true, true, false, null],
  ['brassware-corner', 'Moradabad Brassware Corner', 'shop', 'heritage', 'Brass handicrafts · Home décor · Export quality', 'Third-generation brass karigars. Handcrafted urns, lamps, idols and custom export-order pieces from Peetal Nagri.', '+915912400707', '919812345678', 'Shop 22, Peetal Bazaar, Moradabad', 'Peetal Bazaar', 28.836, 78.7705, 4.9, 214, '10:00 AM – 8:00 PM', true, true, true, null],
  ['glow-glam', 'Glow & Glam Bridal Studio', 'salon', 'salons', 'Bridal makeup · Salon · Spa', 'Bridal packages, party makeup and skincare by certified artists.', '+915912400818', '919812345678', '2nd Floor, Rani Jhansi Plaza, Kanth Road, Moradabad', 'Kanth Road', 28.8443, 78.7901, 4.5, 180, '10:00 AM – 9:00 PM', true, true, false, null],
  ['brass-palace-hotel', 'Hotel Brass Palace', 'hotel', 'hotels', '3-Star Hotel · Banquet · Multi-cuisine', 'Comfortable stays near the railway station with in-house dining.', '+915912400929', '919812345678', 'Station Road, Near Moradabad Junction, Moradabad', 'Station Road', 28.8385, 78.7683, 4.2, 640, '24×7 Front Desk', true, false, false, 'https://brasspalace.example.com'],
  ['grand-heritage-inn', 'Grand Heritage Inn', 'hotel', 'hotels', 'Boutique Stay · Heritage Courtyard', 'Boutique rooms around a heritage courtyard, walkable from Peetal Bazaar.', '+915912401030', '919812345678', 'Chowk Bazaar, Moradabad', 'Chowk Bazaar', 28.8355, 78.7741, 4.4, 232, '24×7 Front Desk', true, false, false, 'https://grandheritage.example.com'],
  ['city-central-mall', 'City Central Mall', 'mall', 'malls', 'Shopping · Food Court · Multiplex', "Moradabad's destination mall with retail stores, food court and cinema.", '+915912401141', '919812345678', 'Sambhal Road, Moradabad', 'Sambhal Road', 28.8188, 78.7822, 4.1, 1180, '10:00 AM – 10:00 PM', true, false, true, null],
  ['wave-cinemas', 'Wave Cinemas — City Central', 'service', 'cinemas', 'Multiplex · 4 Screens · Dolby Atmos', 'First-run Hindi & English films on four screens with recliner seating, Dolby Atmos sound and an in-house snack bar.', '+915912401252', '919812345678', '3rd Floor, City Central Mall, Sambhal Road, Moradabad', 'Sambhal Road', 28.8189, 78.7823, 4.4, 920, '10:30 AM – 11:30 PM', true, false, false, null],
  ['pvr-moradabad', 'PVR: Moradabad Central', 'service', 'cinemas', 'Multiplex · 3 Screens · 4K Laser', 'Premium multiplex with 4K laser projection, luxury loungers and a gourmet counter. Morning shows from ₹149.', '+915912401363', '919812345678', '2nd Floor, Moradabad Central, Delhi Road, Moradabad', 'Delhi Road', 28.8465, 78.7798, 4.6, 1360, '9:30 AM – 12:00 AM', true, false, true, null],
];

const bizRows = biz.map((b) => [
  q(b[0]), q(b[1]), q(b[2]), q(b[4]), q(b[5]), q(b[6]), q(b[7]), q(b[8]), q(b[9]),
  `(select id from public.cities where slug = 'moradabad')`, pt(b[10], b[11]),
  b[12], b[13], q(b[14]), b[15], b[16], b[17], b[18] ? q(b[18]) : 'null', q('approved'),
]);

const bizCatRows = biz.map((b) => [q(b[0]), q(b[3])]);

const bizImgRows = Object.entries(img.businesses).flatMap(([slug, arr]) =>
  arr.map((a) => [q(slug), q(a.url), q(a.public_id), a.sort, a.primary])
);

const doctorRows = [['verma-dental', 'Dr. Anil Verma', 'Dentist', 'BDS, MDS — Prosthodontics', 12, '₹300', 'Painless dentistry — cleaning, fillings, braces and implants.']]
  .map((d) => [q(d[0]), q(d[1]), q(d[2]), q(d[3]), d[4], q(d[5]), q(d[6])]);

const restRows = [
  ['royal-mughal', 'Mughlai, Awadhi, North Indian', '₹₹₹', 'mixed'],
  ['peeli-batti-biryani', 'Biryani, Kebab, Rolls', '₹₹', 'mixed'],
  ['brass-cafe', 'Cafe, Continental, Fast Food', '₹₹', 'veg'],
  ['mughal-dastarkhwan', 'Mughlai, Awadhi', '₹₹', 'mixed'],
].map((r) => [q(r[0]), q(r[1]), q(r[2]), q(r[3])]);

const hotelRows = [
  ['brass-palace-hotel', '3-Star', '₹1,400–₹2,800 / night', ['Wi-Fi', 'Restaurant', 'Parking', 'Room Service', 'Banquet Hall']],
  ['grand-heritage-inn', 'Boutique', '₹1,900–₹3,400 / night', ['Wi-Fi', 'Café', 'Parking', 'Travel Desk']],
];

const menuRows = [
  ['royal-mughal', 'Murgh Musallam (Full)', 'Whole chicken in rich cashew gravy', '₹560', false, 0],
  ['royal-mughal', 'Royal Special Biryani', 'Family pack · saffron & kewra', '₹640', false, 1],
  ['royal-mughal', 'Paneer Shahi Tikka', 'Malai-marinated cottage cheese', '₹340', true, 2],
  ['royal-mughal', 'Mutton Korma', 'Slow-cooked Awadhi style', '₹480', false, 3],
].map((m) => [q(m[0]), q(m[1]), q(m[2]), q(m[3]), m[4], m[5]]);

// oslug, bslug, title, badge, subtitle, description, coupon, tag, validUntil, featured
const offers = [
  ['handicraft-featured', 'trends-n-threads', 'Feel Handicrafts Emporium', '25% OFF', 'on All Boutique', 'Handicraft & handloom showroom — now get flat 25% off on your first online order. Scan the CityBee QR at the counter to redeem.', 'PINZE129', 'Fashion', '2026-09-30', true],
  ['royal-mughal-offer', 'royal-mughal', 'Royal Mughal Restaurant', 'Flat 20% OFF', 'on orders above ₹500', 'Mughlai dining with family seating — show the coupon code FIRSTORDER for 20% off on dine-in and takeaway.', 'FIRSTORDER', 'Dining', '2026-06-30', false],
  ['trends-n-threads-offer', 'trends-n-threads', 'Trends N Threads Boutique', 'Up to 50% OFF', 'on all ethnic wear', 'Designer suits and lehengas from local karigars — up to half price this season with code NEWSTYLE.', 'NEWSTYLE', 'Fashion', '2026-07-15', false],
  ['verma-dental-offer', 'verma-dental', 'Dr. Verma Dental Clinic', '30% OFF', 'on first consultation & cleaning', 'Painless dentistry in the heart of Moradabad — 30% off for first-time CityBee patients with code SMILE20.', 'SMILE20', 'Wellness & Health', '2026-08-31', false],
  ['brassware-offer', 'brassware-corner', 'Moradabad Brassware Corner', 'Flat 10% OFF', 'on brass handicrafts above ₹2,000', 'Export-quality brass handicrafts — flat 10% off on purchases above ₹2,000 with code PEETAL10.', 'PEETAL10', 'Heritage', '2026-10-31', false],
  ['glow-glam-offer', 'glow-glam', 'Glow & Glam Bridal Studio', '25% OFF', 'on bridal packages', 'Bridal makeup and skincare packages — 25% off this wedding season with code GLOWBRIDE.', 'GLOWBRIDE', 'Beauty & Salon', '2026-12-31', false],
];
const offerRows = offers.map((o) => [q(o[1]), q(o[2]), q(o[5]), q(o[3]), q(o[4]), q(o[6]), q(o[7]), q(o[8]), q('active'), o[9]]);
const offerImgRows = offers.map((o) => [q(o[0]), q(o[1]), q(o[2]), q(img.offers[o[0]].url), q(img.offers[o[0]].public_id)]);

// slug, name, citySlug, catSlug(null ok), description, rating, rcount, address, timings, fee, featured, imgKey, lat, lng
const places = [
  ['peetal-bazaar', 'Peetal Bazaar Artisan Market', 'moradabad', 'heritage', 'Discover centuries-old brass workshops & artisan lanes. Perfect half-day walk through the heart of Peetal Nagri.', 4.2, 1200, 'Peetal Bazaar, Moradabad, UP 248001', '10:00 AM – 8:00 PM (Mon–Sat)', 'Free', true, 'peetal-nagri-museum', 28.8362, 78.771],
  ['raza-library', 'Raza Library, Rampur', 'rampur', 'heritage', 'Rare Indo-Islamic manuscripts, miniature paintings and a stunning Mughal-era reading hall — an easy day trip from Moradabad.', 4.7, 860, 'Raza Library, Rampur, UP', '9:00 AM – 5:00 PM (Mon–Fri)', 'Free (ID required)', false, 'jhanda-chowk-bazaar', 28.829, 79.028],
  ['jama-masjid', 'Jama Masjid, Moradabad', 'moradabad', 'heritage', 'Mughal-era mosque with brass-inlaid doors and peaceful courtyards minutes from Chowk Bazaar.', 4.5, 2100, 'Chowk Bazaar, Moradabad', 'Dawn – Dusk', 'Free', false, 'rambagh-dham-park', 28.835, 78.7735],
  ['rudra-lake', 'Rudra Lake & Falhari Siro', 'moradabad', null, 'Lakeside picnic spot with boating and food stalls — a favourite weekend escape for Moradabad families.', 4.3, 640, 'Falhari Siro, Moradabad District', '7:00 AM – 7:00 PM', '₹50 per adult', true, 'prem-mandir-temple', 28.78, 78.85],
  ['paras-water', 'Paras Water Kingdom', 'moradabad', null, 'Water park with slides, wave pool and kids zones — ideal for a summer family day out.', 4.1, 980, 'Delhi Road, Moradabad', '10:00 AM – 7:00 PM', 'From ₹600', false, 'city-forest-lake', 28.86, 78.74],
];

const notifRows = [
  ['New deal near you', 'Royal Mughal: Flat 20% OFF on orders above ₹500', 'offer', 'royal-mughal-offer'],
  ['Booking confirmed', 'Your table at Royal Restaurant & Banquet is set for 8 PM', 'business', 'royal-mughal'],
  ['Weekend explore ideas', 'Peetal Bazaar and Rudra Lake are trending this weekend', 'explore_tab', null],
].map((n) => [q(n[0]), q(n[1]), q(n[2] === 'offer' ? 'offer' : n[2]), n[3] ? `null` : `null`]);

const sql = `-- CityBee demo seed — clearly-marked demo content mirroring the Flutter mock
-- data, with images hosted on Cloudinary under citybee/demo/.
begin;

insert into public.cities (slug, name, state_region, country, country_code, latitude, longitude) values
  ${rows(cities)};

insert into public.categories (name, slug, sort_order) values
  ${rows(categories)};

insert into public.businesses (slug, name, kind, tagline, description, phone, whatsapp, address, locality, city_id, location, rating, review_count, opening_hours, is_verified, is_pure_veg, is_featured, website, status) values
  ${rows(bizRows)};

insert into public.business_categories (business_id, category_id)
select b.id, c.id
from (values ${rows(bizCatRows)}) as v(bslug, cslug)
join public.businesses b on b.slug = v.bslug
join public.categories c on c.slug = v.cslug;

insert into public.business_images (business_id, image_url, public_id, sort_order, is_primary)
select b.id, v.url, v.public_id, v.sort, v.is_primary
from (values ${rows(bizImgRows)}) as v(bslug, url, public_id, sort, is_primary)
join public.businesses b on b.slug = v.bslug;

insert into public.doctors (business_id, name, specialization, qualification, experience_years, consultation_fee, bio)
select b.id, v.name, v.spec, v.qual, v.years, v.fee, v.bio
from (values ${rows(doctorRows)}) as v(bslug, name, spec, qual, years, fee, bio)
join public.businesses b on b.slug = v.bslug;

insert into public.restaurants (business_id, cuisine, price_range, veg_type)
select b.id, v.cuisine, v.price, v.veg
from (values ${rows(restRows)}) as v(bslug, cuisine, price, veg)
join public.businesses b on b.slug = v.bslug;

insert into public.hotels (business_id, hotel_type, price_range)
select b.id, v.htype, v.price
from (values ${rows(hotelRows.map((h) => [q(h[0]), q(h[1]), q(h[2])]))}) as v(bslug, htype, price)
join public.businesses b on b.slug = v.bslug;

insert into public.hotel_amenities (hotel_id, amenity)
select h.id, v.amenity
from (values ${rows(hotelRows.flatMap((h) => h[3].map((am) => [q(h[0]), q(am)])))}) as v(bslug, amenity)
join public.businesses b on b.slug = v.bslug
join public.hotels h on h.business_id = b.id;

insert into public.menu_items (business_id, name, description, price, is_veg, sort_order)
select b.id, v.name, v.descr, v.price, v.veg, v.sort
from (values ${rows(menuRows)}) as v(bslug, name, descr, price, veg, sort)
join public.businesses b on b.slug = v.bslug;

insert into public.offers (business_id, title, description, badge_text, subtitle, coupon_code, category_tag, valid_until, status, is_featured)
select b.id, v.title, v.descr, v.badge, v.subtitle, v.coupon, v.tag, v.valid::date, v.status, v.featured
from (values ${rows(offerRows)}) as v(bslug, title, descr, badge, subtitle, coupon, tag, valid, status, featured)
join public.businesses b on b.slug = v.bslug;

-- offer_images keyed by (business slug, offer title) since offers lack slugs
insert into public.offer_images (offer_id, image_url, public_id, sort_order, is_primary)
select o.id, v.url, v.public_id, 0, true
from (values ${rows(offerImgRows)}) as v(oslug, bslug, title, url, public_id)
join public.businesses b on b.slug = v.bslug
join public.offers o on o.business_id = b.id and o.title = v.title;

${places.map((p) => `insert into public.places (slug, name, description, category_id, city_id, address, location, rating, review_count, is_featured, is_active, timings, entry_fee) values
  (${q(p[0])}, ${q(p[1])}, ${q(p[4])}, ${p[3] ? `(select id from public.categories where slug = ${q(p[3])})` : 'null'}, (select id from public.cities where slug = ${q(p[2])}), ${q(p[7])}, ${pt(p[12], p[13])}, ${p[5]}, ${p[6]}, ${p[10]}, true, ${q(p[8])}, ${q(p[9])});`).join('\n')}

insert into public.place_images (place_id, image_url, public_id, sort_order, is_primary)
select p.id, v.url, v.public_id, 0, true
from (values ${rows(places.map((p) => [q(p[0]), q(img.places[p[11]].url), q(img.places[p[11]].public_id)]))}) as v(pslug, url, public_id)
join public.places p on p.slug = v.pslug;

-- Broadcast demo notifications (user_id null = visible to everyone)
insert into public.notifications (title, message, type, target_type, target_id) values
  ('New deal near you', 'Royal Mughal: Flat 20% OFF on orders above ₹500', 'offer', 'offer', (select o.id from public.offers o join public.businesses b on b.id = o.business_id where b.slug = 'royal-mughal' and o.title = 'Royal Mughal Restaurant')),
  ('Booking confirmed', 'Your table at Royal Restaurant & Banquet is set for 8 PM', 'booking', 'business', (select id from public.businesses where slug = 'royal-mughal')),
  ('Weekend explore ideas', 'Peetal Bazaar and Rudra Lake are trending this weekend', 'editorial', 'explore_tab', null);

commit;
`;

writeFileSync('D:/CityBee/city-bee-backend/supabase/migrations/0003_seed.sql', sql);
console.log('seed SQL written:', sql.length, 'chars');
