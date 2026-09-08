/**
 * Shapes database rows into the payload the CityBee Flutter app renders.
 *
 * The app's `Business` model expects display-ready fields (tagline, images
 * list, feature chips, action buttons) — the API derives those server-side so
 * the Flutter screens keep working unchanged.
 */

export interface BusinessRow {
  id: string;
  slug: string | null;
  name: string;
  kind: string;
  tagline: string;
  description: string;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  address: string;
  locality: string | null;
  rating: string | number;
  review_count: number;
  opening_hours: string | null;
  is_pure_veg: boolean;
  is_verified: boolean;
  is_featured: boolean;
  latitude: number;
  longitude: number;
  distance_m: number | null;
  city_name?: string | null;
  images?: { url: string; public_id: string | null }[];
  doctor?: {
    name: string;
    specialization: string;
    qualification: string | null;
    experience_years: number | null;
    consultation_fee: string | null;
    bio: string | null;
  } | null;
  hotel?: { hotel_type: string | null; price_range: string | null; amenities: string[] } | null;
  restaurant?: { cuisine: string | null; price_range: string | null; veg_type: string | null } | null;
  category_slugs?: string[];
}

export function toBusiness(row: BusinessRow) {
  const kind = row.kind;
  const images = (row.images ?? []).map((i) => i.url);

  // Feature chips mirror the mock data's per-kind content.
  const featureChips: string[] = [];
  if (kind === 'restaurant') {
    if (row.is_pure_veg) featureChips.push('Pure Veg');
    if (row.restaurant?.cuisine) featureChips.push(...row.restaurant.cuisine.split(',').slice(0, 2).map((c) => c.trim()));
    featureChips.push('Family Dining');
  }
  if (kind === 'doctor' && row.doctor) {
    featureChips.push('Walk-ins', row.doctor.specialization);
  }
  if (kind === 'hotel' && row.hotel) {
    featureChips.push(...row.hotel.amenities.slice(0, 3));
  }
  if (kind === 'salon') featureChips.push('Bridal', 'Party Makeup', 'Spa');
  if (kind === 'mall') featureChips.push('Multiplex', 'Food Court', 'Parking');
  if (kind === 'service') featureChips.push('Online Booking');

  const actionButtons =
    kind === 'hotel' && row.website
      ? ['Call', 'Route', 'Website']
      : kind === 'restaurant'
        ? ['Call', 'Route', 'Menu']
        : kind === 'doctor' || kind === 'salon'
          ? ['Call', 'Route', 'Book Visit']
          : ['Call', 'Route', 'WhatsApp'];

  return {
    id: row.slug ?? row.id,
    uuid: row.id,
    name: row.name,
    kind,
    tagline: row.tagline,
    description: row.description,
    images,
    imageReferences: row.images ?? [],
    rating: Number(row.rating),
    ratingCount: row.review_count,
    address: row.address,
    area: row.locality ?? '',
    // Actual CityBee city of the business (e.g. "Hubli") — distinct from the
    // user's selected location; used with distance for honest display.
    cityName: row.city_name ?? '',
    distanceKm: row.distance_m != null ? Math.round((row.distance_m / 1000) * 10) / 10 : null,
    distanceMeters: row.distance_m != null ? Math.round(Number(row.distance_m)) : null,
    phone: row.phone ?? '',
    whatsapp: row.whatsapp ?? '',
    website: row.website,
    openingHours: row.opening_hours ?? '',
    isOpen: !/opens at|closed/i.test(row.opening_hours ?? ''),
    isVerified: row.is_verified,
    isPureVeg: row.is_pure_veg,
    imageBadges: row.is_featured ? ['POPULAR'] : [],
    featureChips: [...new Set(featureChips)].slice(0, 3),
    actionButtons,
    latitude: row.latitude,
    longitude: row.longitude,
    doctor: row.doctor ?? null,
    hotel: row.hotel ?? null,
    restaurant: row.restaurant ?? null,
    categoryIds: row.category_slugs ?? [],
  };
}
