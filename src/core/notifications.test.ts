import { describe, it, expect } from 'vitest';
import { shouldNotify, quickFilter } from './notifications.js';
import { StoredListing, DEFAULT_PREFERENCES } from '../types.js';

const makeStored = (overrides: Partial<StoredListing> = {}): StoredListing => ({
  listing_id: 'ext-1',
  source: 'rapidapi-realty-us',
  id: 'rapidapi-realty-us-ext-1',
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
  hidden: false,
  evaluation_status: 'pending',
  match_score: null,
  match_reason: null,
  mismatch_reason: null,
  first_seen_at: '2026-01-01T00:00:00Z',
  last_seen_at: '2026-01-01T00:00:00Z',
  last_notified_at: null,
  missed_runs: 0,
  ...overrides,
});

describe('quickFilter', () => {
  it('filters out listings above max budget', () => {
    const listing = makeStored({ price: 3000 });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings below min bedrooms', () => {
    const listing = makeStored({ bedrooms: 1 });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings below min bathrooms', () => {
    const listing = makeStored({ bathrooms: 0 });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings with wrong home type', () => {
    const listing = makeStored({ home_type: 'apartment' });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings in excluded areas', () => {
    const prefs = { ...DEFAULT_PREFERENCES, excluded_areas: ['East Austin'] };
    const listing = makeStored({ neighborhood: 'East Austin' });
    expect(quickFilter(listing, prefs)).toBe(false);
  });

  it('filters out hidden listings', () => {
    const listing = makeStored({ hidden: true });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('passes valid listings', () => {
    const listing = makeStored();
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(true);
  });
});

describe('shouldNotify', () => {
  it('allows notification when never notified', () => {
    expect(shouldNotify(makeStored(), 'new')).toBe(true);
  });

  it('blocks notification within 24h cooldown', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: recent });
    expect(shouldNotify(listing, 'new')).toBe(false);
  });

  it('allows price_drop within cooldown', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: recent });
    expect(shouldNotify(listing, 'price_drop')).toBe(true);
  });

  it('allows back_on_market within cooldown', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: recent });
    expect(shouldNotify(listing, 'back_on_market')).toBe(true);
  });

  it('allows notification after 24h cooldown expires', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: old });
    expect(shouldNotify(listing, 'new')).toBe(true);
  });
});
