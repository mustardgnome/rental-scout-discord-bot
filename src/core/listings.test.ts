import { describe, it, expect } from 'vitest';
import {
  normalizeAddress,
  deduplicateListings,
  classifyChange,
  detectMeaningfulChanges,
} from './listings.js';
import { NormalizedListing, StoredListing } from '../types.js';

const makeListing = (overrides: Partial<NormalizedListing> = {}): NormalizedListing => ({
  listing_id: 'ext-1',
  source: 'rapidapi-realty-us',
  address: '123 Example St',
  neighborhood: 'Zilker',
  price: 2200,
  bedrooms: 2,
  bathrooms: 1,
  sqft: 950,
  home_type: 'duplex',
  features: ['yard', 'laundry'],
  description: 'Nice place',
  image_url: null,
  url: 'https://example.com/1',
  status: 'active',
  ...overrides,
});

describe('normalizeAddress', () => {
  it('normalizes to lowercase street number + first word', () => {
    expect(normalizeAddress('123 Example St')).toBe('123 example');
    expect(normalizeAddress('123 Example Street')).toBe('123 example');
    expect(normalizeAddress('  123  Example  Blvd, Unit A ')).toBe('123 example');
  });
});

describe('deduplicateListings', () => {
  it('removes duplicates by normalized address', () => {
    const listings = [
      makeListing({ listing_id: '1', source: 'source-a', address: '123 Example St' }),
      makeListing({ listing_id: '2', source: 'source-b', address: '123 Example Street' }),
      makeListing({ listing_id: '3', source: 'source-a', address: '456 Other Ave' }),
    ];
    const deduped = deduplicateListings(listings);
    expect(deduped).toHaveLength(2);
  });
});

describe('classifyChange', () => {
  const makeStored = (overrides: Partial<StoredListing> = {}): StoredListing => ({
    ...makeListing(),
    id: 'rapidapi-realty-us-ext-1',
    hidden: false,
    evaluation_status: 'evaluated',
    match_score: 50,
    match_reason: null,
    mismatch_reason: null,
    first_seen_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
    last_notified_at: null,
    missed_runs: 0,
    ...overrides,
  });

  it('returns "new" when no existing listing', () => {
    expect(classifyChange(makeListing(), null)).toBe('new');
  });

  it('returns "price_drop" when price decreased', () => {
    const existing = makeStored({ price: 2400 });
    const incoming = makeListing({ price: 2200 });
    expect(classifyChange(incoming, existing)).toBe('price_drop');
  });

  it('returns "back_on_market" when was delisted', () => {
    const existing = makeStored({ status: 'delisted' });
    expect(classifyChange(makeListing(), existing)).toBe('back_on_market');
  });

  it('returns "updated" when meaningful fields change', () => {
    const existing = makeStored({ sqft: 900 });
    const incoming = makeListing({ sqft: 950 });
    expect(classifyChange(incoming, existing)).toBe('updated');
  });

  it('returns null when no meaningful change', () => {
    const existing = makeStored();
    const incoming = makeListing({ description: 'Updated description' });
    expect(classifyChange(incoming, existing)).toBeNull();
  });
});

describe('detectMeaningfulChanges', () => {
  it('detects changed fields', () => {
    const oldData: NormalizedListing = makeListing({ price: 2400, sqft: 900 });
    const newData: NormalizedListing = makeListing({ price: 2200, sqft: 950 });
    const changes = detectMeaningfulChanges(oldData, newData);
    expect(changes).toHaveProperty('price');
    expect(changes).toHaveProperty('sqft');
    expect(changes!.price).toEqual({ old: 2400, new: 2200 });
  });

  it('returns null when no meaningful changes', () => {
    const data = makeListing();
    expect(detectMeaningfulChanges(data, { ...data, description: 'new' })).toBeNull();
  });
});
