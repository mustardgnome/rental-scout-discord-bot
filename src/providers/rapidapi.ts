import axios from 'axios';
import { NormalizedListing, ListingProvider } from '../types.js';

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
    home_type: desc.type || 'unknown',
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

      const queryParams: Record<string, string | number> = {
        city,
        state_code: stateCode,
        limit,
        offset: 0,
        sort: 'newest',
      };

      if (maxPrice) queryParams.price_max = maxPrice;
      if (minBedrooms) queryParams.beds_min = minBedrooms;
      if (minBathrooms) queryParams.baths_min = minBathrooms;

      const response = await axios.get(
        'https://' + host + '/properties/v3/list',
        {
          params: queryParams,
          headers: {
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
