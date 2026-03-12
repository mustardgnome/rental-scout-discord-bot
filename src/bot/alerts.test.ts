import { describe, it, expect } from 'vitest';
import { buildAlertEmbed, buildFeedbackButtons } from './alerts.js';
import { StoredListing } from '../types.js';

const makeStored = (overrides: Partial<StoredListing> = {}): StoredListing => ({
  listing_id: 'ext-1',
  source: 'rapidapi-realty-us',
  id: 'rapidapi-realty-us-ext-1',
  address: '123 Example St, Austin, TX 78704',
  neighborhood: 'Zilker',
  price: 2295,
  bedrooms: 2,
  bathrooms: 1,
  sqft: 950,
  home_type: 'duplex',
  features: ['yard', 'laundry'],
  description: 'Nice duplex',
  image_url: 'https://photos.example.com/1.jpg',
  url: 'https://example.com/1',
  status: 'active',
  hidden: false,
  evaluation_status: 'evaluated',
  match_score: 78,
  match_reason: 'Good South Austin area fit, duplex format.',
  mismatch_reason: 'Slightly above target budget.',
  first_seen_at: '2026-01-01T00:00:00Z',
  last_seen_at: '2026-01-01T00:00:00Z',
  last_notified_at: null,
  missed_runs: 0,
  ...overrides,
});

describe('buildAlertEmbed', () => {
  it('builds a new match embed', () => {
    const embed = buildAlertEmbed(makeStored(), 'new_match');
    expect(embed.data.title).toContain('New Match');
    expect(embed.data.title).toContain('Duplex');
    expect(embed.data.title).toContain('Zilker');
    expect(embed.data.description).toContain('$2,295/mo');
    expect(embed.data.description).toContain('2bd/1ba');
    expect(embed.data.description).toContain('Good South Austin');
    expect(embed.data.url).toBe('https://example.com/1');
  });

  it('builds a price drop embed with old price', () => {
    const embed = buildAlertEmbed(makeStored(), 'price_drop', 2500);
    expect(embed.data.title).toContain('Price Drop');
    expect(embed.data.description).toContain('2,500');
    expect(embed.data.description).toContain('2,295');
  });

  it('sets thumbnail when image_url present', () => {
    const embed = buildAlertEmbed(makeStored(), 'new_match');
    expect(embed.data.thumbnail?.url).toBe('https://photos.example.com/1.jpg');
  });
});

describe('buildFeedbackButtons', () => {
  it('returns two action rows', () => {
    const rows = buildFeedbackButtons('test-listing-id');
    expect(rows).toHaveLength(2);
  });
});
