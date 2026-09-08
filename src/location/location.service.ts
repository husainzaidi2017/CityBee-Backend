import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LocationSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface ResolvedLocation {
  placeId: string;
  name: string;
  stateRegion?: string;
  country: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
}

/**
 * Server-side Google Places proxy.
 *
 * The API key lives only in the backend env — Flutter never sees it. Guests
 * can search locations (location discovery is public content per the spec).
 *
 * Uses the Places API (New): `places:autocomplete` for suggestions and
 * `places/{id}` for details, with the classic Autocomplete as fallback.
 */
@Injectable()
export class LocationService {
  private readonly logger = new Logger(LocationService.name);

  constructor(private readonly config: ConfigService) {}

  private get key(): string {
    const key = this.config.get<string>('googleMapsServerKey');
    if (!key) throw new BadRequestException('Location search is not configured on the server');
    return key;
  }

  async search(query: string): Promise<LocationSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) return [];
    const key = this.key;

    try {
      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
        body: JSON.stringify({
          input: q,
          includedPrimaryTypes: ['locality', 'postal_town', 'administrative_area_level_3'],
          languageCode: 'en',
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Places autocomplete (new) failed: ${res.status} ${await res.text()}`);
        return this.classicAutocomplete(q, key);
      }
      const data = (await res.json()) as {
        suggestions?: {
          placePrediction?: {
            placeId: string;
            structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
            text?: { text?: string };
          };
        }[];
      };
      return (data.suggestions ?? [])
        .map((s) => s.placePrediction)
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({
          placeId: p.placeId,
          mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
          secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        }));
    } catch (err) {
      this.logger.warn(`Places autocomplete error: ${err instanceof Error ? err.message : err}`);
      return this.classicAutocomplete(q, key);
    }
  }

  /** Classic Autocomplete fallback for keys without Places API (New) access. */
  private async classicAutocomplete(q: string, key: string): Promise<LocationSuggestion[]> {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=(cities)&language=en&key=${key}`,
    );
    if (!res.ok) throw new BadRequestException('Location search failed. Please try again.');
    const data = (await res.json()) as {
      status: string;
      predictions?: { place_id: string; structured_formatting?: { main_text?: string; secondary_text?: string } }[];
    };
    if (data.status === 'REQUEST_DENIED') {
      this.logger.error(`Google Places denied the request — check API enablement/key restrictions.`);
      throw new BadRequestException('Location search is not available right now.');
    }
    return (data.predictions ?? []).slice(0, 8).map((p) => ({
      placeId: p.place_id,
      mainText: p.structured_formatting?.main_text ?? '',
      secondaryText: p.structured_formatting?.secondary_text ?? '',
    }));
  }

  async resolve(placeId: string): Promise<ResolvedLocation> {
    const key = this.key;

    // Places API (New) details
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en`,
        {
          headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location',
          },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          id?: string;
          displayName?: { text?: string };
          addressComponents?: { longText?: string; shortText?: string; types?: string[] }[];
          location?: { latitude: number; longitude: number };
        };
        const comp = (type: string) =>
          data.addressComponents?.find((c) => c.types?.includes(type));
        const locality =
          comp('locality')?.longText ?? comp('postal_town')?.longText ?? comp('administrative_area_level_3')?.longText;
        return {
          placeId: data.id ?? placeId,
          name: locality ?? data.displayName?.text ?? '',
          stateRegion: comp('administrative_area_level_1')?.longText,
          country: comp('country')?.longText ?? '',
          countryCode: comp('country')?.shortText,
          latitude: data.location?.latitude ?? 0,
          longitude: data.location?.longitude ?? 0,
        };
      }
      this.logger.warn(`Places details (new) failed: ${res.status}`);
    } catch (err) {
      this.logger.warn(`Places details (new) error: ${err}`);
    }

    // Classic details fallback
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,geometry,address_components,formatted_address&key=${key}`,
    );
    if (!res.ok) throw new BadRequestException('Could not resolve that location.');
    const data = (await res.json()) as {
      status: string;
      result?: {
        name?: string;
        geometry?: { location?: { lat: number; lng: number } };
        address_components?: { long_name?: string; short_name?: string; types?: string[] }[];
      };
    };
    if (data.status !== 'OK' || !data.result) {
      throw new BadRequestException('Could not resolve that location.');
    }
    const comp = (type: string) =>
      data.result?.address_components?.find((c) => c.types?.includes(type));
    const locality =
      comp('locality')?.long_name ?? comp('postal_town')?.long_name ?? comp('administrative_area_level_3')?.long_name;
    return {
      placeId,
      name: locality ?? data.result.name ?? '',
      stateRegion: comp('administrative_area_level_1')?.long_name,
      country: comp('country')?.long_name ?? '',
      countryCode: comp('country')?.short_name,
      latitude: data.result.geometry?.location?.lat ?? 0,
      longitude: data.result.geometry?.location?.lng ?? 0,
    };
  }
}
