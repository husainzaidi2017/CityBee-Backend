import { Inject, Injectable } from '@nestjs/common';
import { Sql } from 'postgres';
import { DATABASE } from '../database/database.module';

export interface ServiceDto {
  id: string;
  name: string;
  category: string | null;
  badge: string;
  rating: string;
  servicesSummary: string;
  priceText: string;
  etaText: string;
  statsText: string;
  trustNote: string;
  image: string;
  actionLabel: string;
  phone: string;
  citySpecialty: boolean;
}

@Injectable()
export class ServicesService {
  constructor(@Inject(DATABASE) private readonly db: Sql) {}

  /**
   * Active home-service experts for a city. Resolution order:
   *   1. lat/lng → nearest CityBee city
   *   2. citySlug / city name match
   *   3. fallback: Moradabad (launch city)
   */
  async findForLocation(lat?: number, lng?: number, citySlug?: string) {
    let cityId: string | undefined;
    if (lat != null && lng != null) {
      const point = this.db`st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`;
      const rows = await this.db`
        select id from public.cities
        where is_active
        order by st_distance(st_setsrid(st_makepoint(longitude, latitude), 4326)::geography, ${point})
        limit 1`;
      cityId = rows[0]?.id;
    }
    if (!cityId && citySlug) {
      const rows = await this.db`
        select id from public.cities
        where lower(slug) = lower(${citySlug}) or lower(name) = lower(${citySlug})
        limit 1`;
      cityId = rows[0]?.id;
    }
    if (!cityId) {
      const rows = await this.db`
        select id from public.cities where slug = 'moradabad' limit 1`;
      cityId = rows[0]?.id;
    }

    const rows = await this.db`
      select slug, name, category, badge, rating, services_summary, price_text,
             eta_text, stats_text, trust_note, image_url, action_label, phone,
             is_city_specialty
      from public.services
      where is_active and (city_id = ${cityId ?? null} or city_id is null)
      order by sort_order, name`;

    const services = rows.map((r) => ({
      id: r.slug,
      name: r.name,
      category: r.category ?? null,
      badge: r.badge ?? '',
      rating: r.rating ?? '4.5',
      servicesSummary: r.services_summary ?? '',
      priceText: r.price_text ?? '',
      etaText: r.eta_text ?? '',
      statsText: r.stats_text ?? '',
      trustNote: r.trust_note ?? '',
      image: r.image_url ?? '',
      actionLabel: r.action_label ?? 'Call Now',
      phone: r.phone ?? '',
      citySpecialty: r.is_city_specialty ?? false,
    })) satisfies ServiceDto[];
    const fallback = this.moradabadFallbackServices();
    const categories = new Set(services.map((s) => s.category));
    for (const item of fallback) {
      if (!categories.has(item.category)) services.push(item);
    }
    return services;
  }

  private moradabadFallbackServices(): ServiceDto[] {
    return [
      {
        id: 'moradabad-electrician',
        name: 'Sharma Electricals',
        category: 'electrician',
        badge: '512 jobs',
        rating: '4.8',
        servicesSummary: 'Wiring, fan, inverter and meter repair',
        priceText: 'From ₹149',
        etaText: '45 min visit',
        statsText: '30-day repair warranty',
        trustNote: 'Certified electrician',
        image: 'https://picsum.photos/seed/moradabad-electrician/600/400',
        actionLabel: 'Call Now',
        phone: '+919876500101',
        citySpecialty: false,
      },
      {
        id: 'moradabad-plumber',
        name: 'Kumar Plumbing & Pipes',
        category: 'plumber',
        badge: '150 jobs',
        rating: '4.7',
        servicesSummary: 'Tap leakage, tank cleaning and pipe fitting',
        priceText: 'From ₹149',
        etaText: '60 min visit',
        statsText: '30-day service warranty',
        trustNote: 'Background verified',
        image: 'https://picsum.photos/seed/moradabad-plumber/600/400',
        actionLabel: 'Call Now',
        phone: '+919876500222',
        citySpecialty: false,
      },
      {
        id: 'moradabad-painter',
        name: 'Rangrej Painting Co.',
        category: 'painter',
        badge: '180 jobs',
        rating: '4.8',
        servicesSummary: 'Room painting, putty and waterproofing',
        priceText: '₹8 / sq ft',
        etaText: 'Free site visit',
        statsText: 'Asian Paints certified',
        trustNote: 'No advance payment',
        image: 'https://picsum.photos/seed/moradabad-painter/600/400',
        actionLabel: 'Get Quote',
        phone: '+919876500104',
        citySpecialty: false,
      },
    ];
  }
}
