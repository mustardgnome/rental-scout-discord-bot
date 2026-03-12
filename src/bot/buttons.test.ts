import { describe, it, expect } from 'vitest';
import { parseFeedbackCustomId } from './buttons.js';

describe('parseFeedbackCustomId', () => {
  it('parses a valid feedback custom ID', () => {
    const result = parseFeedbackCustomId('feedback:love_it:rapidapi-realty-us-ext-1');
    expect(result).toEqual({
      feedbackType: 'love_it',
      listingId: 'rapidapi-realty-us-ext-1',
    });
  });

  it('returns null for non-feedback custom IDs', () => {
    expect(parseFeedbackCustomId('other:thing')).toBeNull();
  });

  it('handles listing IDs with colons', () => {
    const result = parseFeedbackCustomId('feedback:hide:some-source-id-123');
    expect(result).toEqual({
      feedbackType: 'hide',
      listingId: 'some-source-id-123',
    });
  });
});
