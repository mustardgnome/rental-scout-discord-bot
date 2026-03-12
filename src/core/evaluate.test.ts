import { describe, it, expect } from 'vitest';
import {
  buildFeedbackSummary,
  buildEvaluationPrompt,
  parseEvaluationResponse,
  SYSTEM_PROMPT,
} from './evaluate.js';
import { ListingCandidate, StoredListing, DEFAULT_PREFERENCES } from '../types.js';

const makeCandidate = (): ListingCandidate => ({
  listing: {
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
  },
  change_type: 'new',
});

describe('buildFeedbackSummary', () => {
  it('returns no feedback message when empty', () => {
    expect(buildFeedbackSummary([])).toBe('No feedback recorded yet.');
  });

  it('aggregates feedback by type', () => {
    const feedback = [
      { listing_id: 'a', feedback_type: 'hide', created_at: '2026-01-01', neighborhood: 'East Austin', price: 2200, home_type: 'apartment' },
      { listing_id: 'b', feedback_type: 'hide', created_at: '2026-01-02', neighborhood: 'East Austin', price: 2300, home_type: 'condo' },
      { listing_id: 'c', feedback_type: 'love_it', created_at: '2026-01-03', neighborhood: 'Zilker', price: 2100, home_type: 'duplex' },
    ];
    const summary = buildFeedbackSummary(feedback);
    expect(summary).toContain('hidden 2 listing(s)');
    expect(summary).toContain('East Austin');
    expect(summary).toContain('loved 1 listing(s)');
  });

  it('caps summary at 500 characters', () => {
    const feedback = Array.from({ length: 50 }, (_, i) => ({
      listing_id: `id-${i}`,
      feedback_type: 'hide',
      created_at: '2026-01-01',
      neighborhood: `Neighborhood${i}WithALongName`,
      price: 2000 + i,
      home_type: 'house',
    }));
    const summary = buildFeedbackSummary(feedback);
    expect(summary.length).toBeLessThanOrEqual(500);
  });
});

describe('buildEvaluationPrompt', () => {
  it('includes preferences and listings in prompt', () => {
    const prompt = buildEvaluationPrompt(
      DEFAULT_PREFERENCES,
      [makeCandidate()],
      'No feedback recorded yet.',
      [],
    );
    expect(prompt).toContain('Austin, TX');
    expect(prompt).toContain('rapidapi-realty-us-ext-1');
    expect(prompt).toContain('No feedback recorded yet.');
  });

  it('truncates listing descriptions to 300 chars', () => {
    const candidate = makeCandidate();
    candidate.listing.description = 'x'.repeat(500);
    const prompt = buildEvaluationPrompt(
      DEFAULT_PREFERENCES,
      [candidate],
      '',
      [],
    );
    expect(prompt).not.toContain('x'.repeat(500));
    expect(prompt).toContain('x'.repeat(300));
  });
});

describe('parseEvaluationResponse', () => {
  it('parses valid JSON response', () => {
    const response = JSON.stringify({
      results: [{
        listing_id: 'test-1',
        match_score: 78,
        notify: true,
        why_match: 'Good fit',
        why_not: 'Over budget',
        alert_type: 'new_match',
      }],
    });
    const results = parseEvaluationResponse(response);
    expect(results).toHaveLength(1);
    expect(results![0].match_score).toBe(78);
  });

  it('returns null for malformed JSON', () => {
    expect(parseEvaluationResponse('not json')).toBeNull();
  });

  it('returns null for missing results array', () => {
    expect(parseEvaluationResponse(JSON.stringify({ bad: true }))).toBeNull();
  });
});

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(SYSTEM_PROMPT).toContain('Austin');
  });
});
