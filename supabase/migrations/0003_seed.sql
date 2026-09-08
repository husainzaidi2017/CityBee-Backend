-- CityBee demo seed — clearly-marked demo content mirroring the Flutter mock
-- data, with images hosted on Cloudinary under citybee/demo/.
begin;

insert into public.cities (slug, name, state_region, country, country_code, latitude, longitude) values
  ('moradabad', 'Moradabad', 'Uttar Pradesh', 'India', 'IN', 28.8386, 78.7733),
  ('bareilly', 'Bareilly', 'Uttar Pradesh', 'India', 'IN', 28.367, 79.4305),
  ('rampur', 'Rampur', 'Uttar Pradesh', 'India', 'IN', 28.8082, 79.0253);

insert into public.categories (name, slug, sort_order) values
  ('Fashion', 'fashion', 1),
  ('Grocery', 'grocery', 2),
  ('Food & Dining', 'dining', 3),
  ('Doctors', 'doctors', 4),
  ('Hotels', 'hotels', 5),
  ('Barbers', 'barbers', 6),
  ('Heritage', 'heritage', 7),
  ('Salons', 'salons', 8),
  ('Malls', 'malls', 9),
  ('Cinemas', 'cinemas', 10);

insert into public.businesses (slug, name, kind, tagline, description, phone, whatsapp, address, locality, city_id, location, rating, review_count, opening_hours, is_verified, is_pure_veg, is_featured, website, status) values
  ('royal-mughal', 'Royal Restaurant & Banquet', 'restaurant', 'Mughlai · Awadhi · North Indian', 'A Moradabad landmark for Mughlai dining and grand banquets. Family dining hall, pure-veg kitchen and up to 300-pax banquet space.', '+915912400161', '919876543210', '16B, Delhi Road, Near Majhola Chauraha, Civil Lines, Moradabad, UP 248001', 'Civil Lines, Moradabad', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7759, 28.8371), 4326)::geography, 4.6, 1240, '11:00 AM – 11:30 PM', true, false, true, null, 'approved'),
  ('peeli-batti-biryani', 'Peeli Batti Biryani House', 'restaurant', 'Biryani · Kebab · Rolls', 'Slow-cooked Moradabadi biryani served late into the night at Peeli Batti.', '+915912400282', '919812345678', 'Peeli Batti Chowk, Budh Bazaar, Moradabad', 'Budh Bazaar', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7712, 28.8291), 4326)::geography, 4.3, 860, '12:00 PM – 1:00 AM', true, false, false, null, 'approved'),
  ('brass-cafe', 'The Brass Cafe', 'restaurant', 'Cafe · Continental · Fast Food', 'Brass-themed cafe serving coffee, shakes and continental snacks.', '+915912400393', '919876543210', 'Shop 7, Cantonment Road, Civil Lines, Moradabad', 'Civil Lines', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7701, 28.842), 4326)::geography, 4.5, 412, 'Opens at 11:00 AM', true, true, false, null, 'approved'),
  ('mughal-dastarkhwan', 'Mughal Dastarkhwan', 'restaurant', 'Mughlai · Family Dining', 'Traditional dastarkhwan dining with Awadhi delicacies.', '+915912400474', '919876543210', 'Delhi Road, Opp. Transport Nagar, Moradabad', 'Delhi Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.781, 28.848), 4326)::geography, 4.2, 530, '11:30 AM – 11:00 PM', false, false, false, null, 'approved'),
  ('verma-dental', 'Dr. Verma Dental Clinic', 'doctor', 'Dentist · BDS, MDS (Prosthodontics)', 'Painless dentistry — cleaning, fillings, braces and implants. Walk-ins welcome, first consultation discounted via CityBee.', '+915912400585', '919812345678', '1st Floor, Harvard Tower, Court Road, Moradabad', 'Court Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7769, 28.8388), 4326)::geography, 4.8, 490, 'Mon–Sat · 10:00 AM – 2:00 PM, 5:00 – 8:30 PM', true, true, false, null, 'approved'),
  ('trends-n-threads', 'Trends N Threads Boutique', 'shop', 'Boutique · Designer Wear · Alterations', 'Designer suits, lehengas and bespoke tailoring by local craftsmen.', '+915912400696', '919876543210', 'B-14, Subhash Nagar, Moradabad', 'Subhash Nagar', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7768, 28.8221), 4326)::geography, 4.4, 320, '10:30 AM – 8:30 PM', true, true, false, null, 'approved'),
  ('brassware-corner', 'Moradabad Brassware Corner', 'shop', 'Brass handicrafts · Home décor · Export quality', 'Third-generation brass karigars. Handcrafted urns, lamps, idols and custom export-order pieces from Peetal Nagri.', '+915912400707', '919812345678', 'Shop 22, Peetal Bazaar, Moradabad', 'Peetal Bazaar', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7705, 28.836), 4326)::geography, 4.9, 214, '10:00 AM – 8:00 PM', true, true, true, null, 'approved'),
  ('glow-glam', 'Glow & Glam Bridal Studio', 'salon', 'Bridal makeup · Salon · Spa', 'Bridal packages, party makeup and skincare by certified artists.', '+915912400818', '919812345678', '2nd Floor, Rani Jhansi Plaza, Kanth Road, Moradabad', 'Kanth Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7901, 28.8443), 4326)::geography, 4.5, 180, '10:00 AM – 9:00 PM', true, true, false, null, 'approved'),
  ('brass-palace-hotel', 'Hotel Brass Palace', 'hotel', '3-Star Hotel · Banquet · Multi-cuisine', 'Comfortable stays near the railway station with in-house dining.', '+915912400929', '919812345678', 'Station Road, Near Moradabad Junction, Moradabad', 'Station Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7683, 28.8385), 4326)::geography, 4.2, 640, '24×7 Front Desk', true, false, false, 'https://brasspalace.example.com', 'approved'),
  ('grand-heritage-inn', 'Grand Heritage Inn', 'hotel', 'Boutique Stay · Heritage Courtyard', 'Boutique rooms around a heritage courtyard, walkable from Peetal Bazaar.', '+915912401030', '919812345678', 'Chowk Bazaar, Moradabad', 'Chowk Bazaar', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7741, 28.8355), 4326)::geography, 4.4, 232, '24×7 Front Desk', true, false, false, 'https://grandheritage.example.com', 'approved'),
  ('city-central-mall', 'City Central Mall', 'mall', 'Shopping · Food Court · Multiplex', 'Moradabad''s destination mall with retail stores, food court and cinema.', '+915912401141', '919812345678', 'Sambhal Road, Moradabad', 'Sambhal Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7822, 28.8188), 4326)::geography, 4.1, 1180, '10:00 AM – 10:00 PM', true, false, true, null, 'approved'),
  ('wave-cinemas', 'Wave Cinemas — City Central', 'service', 'Multiplex · 4 Screens · Dolby Atmos', 'First-run Hindi & English films on four screens with recliner seating, Dolby Atmos sound and an in-house snack bar.', '+915912401252', '919812345678', '3rd Floor, City Central Mall, Sambhal Road, Moradabad', 'Sambhal Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7823, 28.8189), 4326)::geography, 4.4, 920, '10:30 AM – 11:30 PM', true, false, false, null, 'approved'),
  ('pvr-moradabad', 'PVR: Moradabad Central', 'service', 'Multiplex · 3 Screens · 4K Laser', 'Premium multiplex with 4K laser projection, luxury loungers and a gourmet counter. Morning shows from ₹149.', '+915912401363', '919812345678', '2nd Floor, Moradabad Central, Delhi Road, Moradabad', 'Delhi Road', (select id from public.cities where slug = 'moradabad'), st_setsrid(st_makepoint(78.7798, 28.8465), 4326)::geography, 4.6, 1360, '9:30 AM – 12:00 AM', true, false, true, null, 'approved');

insert into public.business_categories (business_id, category_id)
select b.id, c.id
from (values ('royal-mughal', 'dining'),
  ('peeli-batti-biryani', 'dining'),
  ('brass-cafe', 'dining'),
  ('mughal-dastarkhwan', 'dining'),
  ('verma-dental', 'doctors'),
  ('trends-n-threads', 'fashion'),
  ('brassware-corner', 'heritage'),
  ('glow-glam', 'salons'),
  ('brass-palace-hotel', 'hotels'),
  ('grand-heritage-inn', 'hotels'),
  ('city-central-mall', 'malls'),
  ('wave-cinemas', 'cinemas'),
  ('pvr-moradabad', 'cinemas')) as v(bslug, cslug)
join public.businesses b on b.slug = v.bslug
join public.categories c on c.slug = v.cslug;

insert into public.business_images (business_id, image_url, public_id, sort_order, is_primary)
select b.id, v.url, v.public_id, v.sort, v.is_primary
from (values ('royal-mughal', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886807/citybee/demo/csdxdkhc2xwe6g9xdkd1.png', 'citybee/demo/csdxdkhc2xwe6g9xdkd1', 0, true),
  ('royal-mughal', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886808/citybee/demo/wweqet4ualogxxc1x149.png', 'citybee/demo/wweqet4ualogxxc1x149', 1, false),
  ('royal-mughal', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886809/citybee/demo/jhfmougraomvwx274jfh.png', 'citybee/demo/jhfmougraomvwx274jfh', 2, false),
  ('peeli-batti-biryani', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886810/citybee/demo/uhw8bzbj5bjotjzzkghl.png', 'citybee/demo/uhw8bzbj5bjotjzzkghl', 0, true),
  ('brass-cafe', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886811/citybee/demo/hutaghxay1aycm9vdcf8.png', 'citybee/demo/hutaghxay1aycm9vdcf8', 0, true),
  ('mughal-dastarkhwan', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886812/citybee/demo/jkgftfcdkvan3ppqt7r4.png', 'citybee/demo/jkgftfcdkvan3ppqt7r4', 0, true),
  ('verma-dental', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886814/citybee/demo/hjo6q2p8it58fanxmeyo.png', 'citybee/demo/hjo6q2p8it58fanxmeyo', 0, true),
  ('trends-n-threads', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886815/citybee/demo/oejzpkqkwdjn9dkplett.png', 'citybee/demo/oejzpkqkwdjn9dkplett', 0, true),
  ('brassware-corner', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886816/citybee/demo/c4m4h0xahq13n0rccrns.png', 'citybee/demo/c4m4h0xahq13n0rccrns', 0, true),
  ('glow-glam', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886817/citybee/demo/t3bcp88ysi7xoq0i23ui.png', 'citybee/demo/t3bcp88ysi7xoq0i23ui', 0, true),
  ('brass-palace-hotel', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886818/citybee/demo/bd9uvet3zjdu0vqx5w1g.png', 'citybee/demo/bd9uvet3zjdu0vqx5w1g', 0, true),
  ('brass-palace-hotel', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886819/citybee/demo/cipizo6xexwxkay7d0b9.png', 'citybee/demo/cipizo6xexwxkay7d0b9', 1, false),
  ('grand-heritage-inn', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886821/citybee/demo/vzncbgvctahojjzwbdzv.png', 'citybee/demo/vzncbgvctahojjzwbdzv', 0, true),
  ('city-central-mall', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886821/citybee/demo/y1ack2sjqkvfai8e8ofh.png', 'citybee/demo/y1ack2sjqkvfai8e8ofh', 0, true),
  ('mor-fresh-mart', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886823/citybee/demo/rwq4edbnn3oveyqxhgtw.png', 'citybee/demo/rwq4edbnn3oveyqxhgtw', 0, true),
  ('the-barber-lounge', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886825/citybee/demo/raxkdfwfodp8fc0jewq3.png', 'citybee/demo/raxkdfwfodp8fc0jewq3', 0, true)) as v(bslug, url, public_id, sort, is_primary)
join public.businesses b on b.slug = v.bslug;

insert into public.doctors (business_id, name, specialization, qualification, experience_years, consultation_fee, bio)
select b.id, v.name, v.spec, v.qual, v.years, v.fee, v.bio
from (values ('verma-dental', 'Dr. Anil Verma', 'Dentist', 'BDS, MDS — Prosthodontics', 12, '₹300', 'Painless dentistry — cleaning, fillings, braces and implants.')) as v(bslug, name, spec, qual, years, fee, bio)
join public.businesses b on b.slug = v.bslug;

insert into public.restaurants (business_id, cuisine, price_range, veg_type)
select b.id, v.cuisine, v.price, v.veg
from (values ('royal-mughal', 'Mughlai, Awadhi, North Indian', '₹₹₹', 'mixed'),
  ('peeli-batti-biryani', 'Biryani, Kebab, Rolls', '₹₹', 'mixed'),
  ('brass-cafe', 'Cafe, Continental, Fast Food', '₹₹', 'veg'),
  ('mughal-dastarkhwan', 'Mughlai, Awadhi', '₹₹', 'mixed')) as v(bslug, cuisine, price, veg)
join public.businesses b on b.slug = v.bslug;

insert into public.hotels (business_id, hotel_type, price_range)
select b.id, v.htype, v.price
from (values ('brass-palace-hotel', '3-Star', '₹1,400–₹2,800 / night'),
  ('grand-heritage-inn', 'Boutique', '₹1,900–₹3,400 / night')) as v(bslug, htype, price)
join public.businesses b on b.slug = v.bslug;

insert into public.hotel_amenities (hotel_id, amenity)
select h.id, v.amenity
from (values ('brass-palace-hotel', 'Wi-Fi'),
  ('brass-palace-hotel', 'Restaurant'),
  ('brass-palace-hotel', 'Parking'),
  ('brass-palace-hotel', 'Room Service'),
  ('brass-palace-hotel', 'Banquet Hall'),
  ('grand-heritage-inn', 'Wi-Fi'),
  ('grand-heritage-inn', 'Café'),
  ('grand-heritage-inn', 'Parking'),
  ('grand-heritage-inn', 'Travel Desk')) as v(bslug, amenity)
join public.businesses b on b.slug = v.bslug
join public.hotels h on h.business_id = b.id;

insert into public.menu_items (business_id, name, description, price, is_veg, sort_order)
select b.id, v.name, v.descr, v.price, v.veg, v.sort
from (values ('royal-mughal', 'Murgh Musallam (Full)', 'Whole chicken in rich cashew gravy', '₹560', false, 0),
  ('royal-mughal', 'Royal Special Biryani', 'Family pack · saffron & kewra', '₹640', false, 1),
  ('royal-mughal', 'Paneer Shahi Tikka', 'Malai-marinated cottage cheese', '₹340', true, 2),
  ('royal-mughal', 'Mutton Korma', 'Slow-cooked Awadhi style', '₹480', false, 3)) as v(bslug, name, descr, price, veg, sort)
join public.businesses b on b.slug = v.bslug;

insert into public.offers (business_id, title, description, badge_text, subtitle, coupon_code, category_tag, valid_until, status, is_featured)
select b.id, v.title, v.descr, v.badge, v.subtitle, v.coupon, v.tag, v.valid::date, v.status, v.featured
from (values ('trends-n-threads', 'Feel Handicrafts Emporium', 'Handicraft & handloom showroom — now get flat 25% off on your first online order. Scan the CityBee QR at the counter to redeem.', '25% OFF', 'on All Boutique', 'PINZE129', 'Fashion', '2026-09-30', 'active', true),
  ('royal-mughal', 'Royal Mughal Restaurant', 'Mughlai dining with family seating — show the coupon code FIRSTORDER for 20% off on dine-in and takeaway.', 'Flat 20% OFF', 'on orders above ₹500', 'FIRSTORDER', 'Dining', '2026-06-30', 'active', false),
  ('trends-n-threads', 'Trends N Threads Boutique', 'Designer suits and lehengas from local karigars — up to half price this season with code NEWSTYLE.', 'Up to 50% OFF', 'on all ethnic wear', 'NEWSTYLE', 'Fashion', '2026-07-15', 'active', false),
  ('verma-dental', 'Dr. Verma Dental Clinic', 'Painless dentistry in the heart of Moradabad — 30% off for first-time CityBee patients with code SMILE20.', '30% OFF', 'on first consultation & cleaning', 'SMILE20', 'Wellness & Health', '2026-08-31', 'active', false),
  ('brassware-corner', 'Moradabad Brassware Corner', 'Export-quality brass handicrafts — flat 10% off on purchases above ₹2,000 with code PEETAL10.', 'Flat 10% OFF', 'on brass handicrafts above ₹2,000', 'PEETAL10', 'Heritage', '2026-10-31', 'active', false),
  ('glow-glam', 'Glow & Glam Bridal Studio', 'Bridal makeup and skincare packages — 25% off this wedding season with code GLOWBRIDE.', '25% OFF', 'on bridal packages', 'GLOWBRIDE', 'Beauty & Salon', '2026-12-31', 'active', false)) as v(bslug, title, descr, badge, subtitle, coupon, tag, valid, status, featured)
join public.businesses b on b.slug = v.bslug;

-- offer_images keyed by (business slug, offer title) since offers lack slugs
insert into public.offer_images (offer_id, image_url, public_id, sort_order, is_primary)
select o.id, v.url, v.public_id, 0, true
from (values ('handicraft-featured', 'trends-n-threads', 'Feel Handicrafts Emporium', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886834/citybee/demo/pxins1lgo8brncnpadl1.png', 'citybee/demo/pxins1lgo8brncnpadl1'),
  ('royal-mughal-offer', 'royal-mughal', 'Royal Mughal Restaurant', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886835/citybee/demo/dfkytpbiwfffyxekxouj.png', 'citybee/demo/dfkytpbiwfffyxekxouj'),
  ('trends-n-threads-offer', 'trends-n-threads', 'Trends N Threads Boutique', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886836/citybee/demo/dsbxqlnlozprellrqqgt.png', 'citybee/demo/dsbxqlnlozprellrqqgt'),
  ('verma-dental-offer', 'verma-dental', 'Dr. Verma Dental Clinic', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886837/citybee/demo/oxzlzwbacikp9ekxne9f.png', 'citybee/demo/oxzlzwbacikp9ekxne9f'),
  ('brassware-offer', 'brassware-corner', 'Moradabad Brassware Corner', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886838/citybee/demo/cucqzjxpig156h4fjgxi.png', 'citybee/demo/cucqzjxpig156h4fjgxi'),
  ('glow-glam-offer', 'glow-glam', 'Glow & Glam Bridal Studio', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886839/citybee/demo/hj7xjcuykpwltf0cnbeu.png', 'citybee/demo/hj7xjcuykpwltf0cnbeu')) as v(oslug, bslug, title, url, public_id)
join public.businesses b on b.slug = v.bslug
join public.offers o on o.business_id = b.id and o.title = v.title;

insert into public.places (slug, name, description, category_id, city_id, address, location, rating, review_count, is_featured, is_active, timings, entry_fee) values
  ('peetal-bazaar', 'Peetal Bazaar Artisan Market', 'Discover centuries-old brass workshops & artisan lanes. Perfect half-day walk through the heart of Peetal Nagri.', (select id from public.categories where slug = 'heritage'), (select id from public.cities where slug = 'moradabad'), 'Peetal Bazaar, Moradabad, UP 248001', st_setsrid(st_makepoint(78.771, 28.8362), 4326)::geography, 4.2, 1200, true, true, '10:00 AM – 8:00 PM (Mon–Sat)', 'Free');
insert into public.places (slug, name, description, category_id, city_id, address, location, rating, review_count, is_featured, is_active, timings, entry_fee) values
  ('raza-library', 'Raza Library, Rampur', 'Rare Indo-Islamic manuscripts, miniature paintings and a stunning Mughal-era reading hall — an easy day trip from Moradabad.', (select id from public.categories where slug = 'heritage'), (select id from public.cities where slug = 'rampur'), 'Raza Library, Rampur, UP', st_setsrid(st_makepoint(79.028, 28.829), 4326)::geography, 4.7, 860, false, true, '9:00 AM – 5:00 PM (Mon–Fri)', 'Free (ID required)');
insert into public.places (slug, name, description, category_id, city_id, address, location, rating, review_count, is_featured, is_active, timings, entry_fee) values
  ('jama-masjid', 'Jama Masjid, Moradabad', 'Mughal-era mosque with brass-inlaid doors and peaceful courtyards minutes from Chowk Bazaar.', (select id from public.categories where slug = 'heritage'), (select id from public.cities where slug = 'moradabad'), 'Chowk Bazaar, Moradabad', st_setsrid(st_makepoint(78.7735, 28.835), 4326)::geography, 4.5, 2100, false, true, 'Dawn – Dusk', 'Free');
insert into public.places (slug, name, description, category_id, city_id, address, location, rating, review_count, is_featured, is_active, timings, entry_fee) values
  ('rudra-lake', 'Rudra Lake & Falhari Siro', 'Lakeside picnic spot with boating and food stalls — a favourite weekend escape for Moradabad families.', null, (select id from public.cities where slug = 'moradabad'), 'Falhari Siro, Moradabad District', st_setsrid(st_makepoint(78.85, 28.78), 4326)::geography, 4.3, 640, true, true, '7:00 AM – 7:00 PM', '₹50 per adult');
insert into public.places (slug, name, description, category_id, city_id, address, location, rating, review_count, is_featured, is_active, timings, entry_fee) values
  ('paras-water', 'Paras Water Kingdom', 'Water park with slides, wave pool and kids zones — ideal for a summer family day out.', null, (select id from public.cities where slug = 'moradabad'), 'Delhi Road, Moradabad', st_setsrid(st_makepoint(78.74, 28.86), 4326)::geography, 4.1, 980, false, true, '10:00 AM – 7:00 PM', 'From ₹600');

insert into public.place_images (place_id, image_url, public_id, sort_order, is_primary)
select p.id, v.url, v.public_id, 0, true
from (values ('peetal-bazaar', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886827/citybee/demo/jik0x9txse6at0ibf4xu.png', 'citybee/demo/jik0x9txse6at0ibf4xu'),
  ('raza-library', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886829/citybee/demo/ktfzdbuysrwrorwwtol8.png', 'citybee/demo/ktfzdbuysrwrorwwtol8'),
  ('jama-masjid', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886831/citybee/demo/ekffavwodwp0kd4mqqwy.png', 'citybee/demo/ekffavwodwp0kd4mqqwy'),
  ('rudra-lake', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886832/citybee/demo/ynhghpx7qsrhhwqkzyhb.png', 'citybee/demo/ynhghpx7qsrhhwqkzyhb'),
  ('paras-water', 'https://res.cloudinary.com/egzlojgo/image/upload/v1788886833/citybee/demo/fmkry7bageeuggksukhr.png', 'citybee/demo/fmkry7bageeuggksukhr')) as v(pslug, url, public_id)
join public.places p on p.slug = v.pslug;

-- Broadcast demo notifications (user_id null = visible to everyone)
insert into public.notifications (title, message, type, target_type, target_id) values
  ('New deal near you', 'Royal Mughal: Flat 20% OFF on orders above ₹500', 'offer', 'offer', (select o.id from public.offers o join public.businesses b on b.id = o.business_id where b.slug = 'royal-mughal' and o.title = 'Royal Mughal Restaurant')),
  ('Booking confirmed', 'Your table at Royal Restaurant & Banquet is set for 8 PM', 'booking', 'business', (select id from public.businesses where slug = 'royal-mughal')),
  ('Weekend explore ideas', 'Peetal Bazaar and Rudra Lake are trending this weekend', 'editorial', 'explore_tab', null);

commit;
