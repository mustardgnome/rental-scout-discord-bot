import { describe, it, expect } from 'vitest';
import { normalizeRealtyUsListing } from './rapidapi.js';

describe('normalizeRealtyUsListing', () => {
  it('normalizes a raw Realty in US API response to NormalizedListing', () => {
    const raw = {
      property_id: 'M1234567890',
      list_price: 2200,
      description: {
        beds: 2,
        baths: 1,
        sqft: 950,
        type: 'duplex',
        text: 'Nice duplex in South Austin with wood floors and yard.',
      },
      location: {
        address: {
          line: '123 Example St',
          city: 'Austin',
          state_code: 'TX',
          postal_code: '78704',
        },
        neighborhoods: [{ name: 'Zilker' }],
      },
      photos: [{ href: 'https://photos.example.com/1.jpg' }],
      href: 'https://www.realtor.com/listing/123',
      status: 'for_rent',
      tags: ['laundry', 'yard'],
    };

    const listing = normalizeRealtyUsListing(raw);
    expect(listing.listing_id).toBe('M1234567890');
    expect(listing.source).toBe('rapidapi-realty-us');
    expect(listing.price).toBe(2200);
    expect(listing.bedrooms).toBe(2);
    expect(listing.neighborhood).toBe('Zilker');
    expect(listing.image_url).toBe('https://photos.example.com/1.jpg');
    expect(listing.status).toBe('active');
  });

  it('handles missing optional fields gracefully', () => {
    const raw = {
      property_id: 'M9999',
      list_price: 1800,
      description: { beds: 1, baths: 1, type: 'apartment' },
      location: {
        address: { line: '456 Other Ave', city: 'Austin', state_code: 'TX', postal_code: '78701' },
      },
      status: 'for_rent',
    };

    const listing = normalizeRealtyUsListing(raw);
    expect(listing.sqft).toBeNull();
    expect(listing.neighborhood).toBe('');
    expect(listing.image_url).toBeNull();
    expect(listing.features).toEqual([]);
    expect(listing.description).toBe('');
  });
});
