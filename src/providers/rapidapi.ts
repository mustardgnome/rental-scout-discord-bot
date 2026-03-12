import axios from 'axios';
import { NormalizedListing, ListingProvider } from '../types.js';

const HOME_TYPE_MAP: Record<string, string> = {
  single_family: 'house',
  multi_family: 'duplex',
  duplex_triplex: 'duplex',
  townhomes: 'townhome',
  townhouse: 'townhome',
  condos: 'condo',
  condo: 'condo',
  apartment: 'apartment',
  apartments: 'apartment',
};

function normalizeHomeType(raw: string): string {
  const lower = raw.toLowerCase().replace(/\s+/g, '_');
  return HOME_TYPE_MAP[lower] || lower;
}

export function normalizeRealtyUsListing(raw: any): NormalizedListing {
  const addr = raw.location?.address || {};
  const neighborhoods = raw.location?.neighborhoods || [];
  const desc = raw.description || {};

  return {
    listing_id: raw.property_id || '',
    source: 'rapidapi-realty-us',
    address: `${addr.line || ''}, ${addr.city || ''}, ${addr.state_code || ''} ${addr.postal_code || ''}`.trim(),
    neighborhood: neighborhoods[0]?.name || '',
    price: raw.list_price || 0,
    bedrooms: desc.beds || 0,
    bathrooms: desc.baths || 0,
    sqft: desc.sqft || null,
    home_type: normalizeHomeType(desc.type || 'unknown'),
    features: raw.tags || [],
    description: desc.text || '',
    image_url: raw.photos?.[0]?.href || null,
    url: raw.href || '',
    status: raw.status === 'for_rent' ? 'active' : raw.status || 'active',
  };
}

export function createRapidApiProvider(
  apiKey: string,
  host: string,
  sourceName: string,
): ListingProvider {
  return {
    name: `rapidapi-${sourceName}`,

    async fetchListings(params) {
      const { city, stateCode, limit, maxPrice, minBedrooms, minBathrooms } =
        params;

      const body: Record<string, any> = {
        limit,
        offset: 0,
        city,
        state_code: stateCode,
        status: ['for_rent'],
        sort: { direction: 'desc', field: 'list_date' },
      };

      if (maxPrice) body.price_max = maxPrice;
      if (minBedrooms) body.beds_min = minBedrooms;
      if (minBathrooms) body.baths_min = minBathrooms;

      const response = await axios.post(
        'https://' + host + '/properties/v3/list',
        body,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': host,
          },
          timeout: 30000,
        },
      );

      const properties = response.data?.data?.home_search?.results || [];
      return properties.map(normalizeRealtyUsListing);
    },
  };
}
