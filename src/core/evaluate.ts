import Anthropic from '@anthropic-ai/sdk';
import {
  UserPreferences,
  ClaudeEvaluationResult,
  ListingCandidate,
} from '../types.js';

export const SYSTEM_PROMPT = `You are helping power a personal rental-finder bot for one user in Austin, Texas.

This is not a public product and not a multi-user marketplace.
Your job is simple: look at Austin rental listings and decide whether they seem worth notifying the user about.

Keep your analysis practical and lightweight.

Priorities:
- fit to budget
- fit to Austin area preferences
- fit to home-type preferences
- fit to must-have features
- general vibe fit
- whether the listing seems promising enough to click on

Do not overcomplicate the analysis.
Do not write long essays.

For each listing, return:
- match_score: 0-100
- notify: boolean (your recommendation on whether to send this to the user)
- why_match: 1-2 sentences on why it fits
- why_not: 1-2 sentences on concerns
- alert_type: confirm or override the suggested alert_type. Valid values: "new_match", "price_drop", "back_on_market", "improved_listing", "ignore"

Be conservative about notifications. A listing does not need to be perfect, but it should feel plausibly worth the user's attention. Avoid spam.

Many listings have sparse or generic descriptions. Do not heavily penalize a listing just because its description lacks detail about aesthetics or vibe. If the basics match (location, price, bedrooms, home type), give it a moderate score — the user can decide from photos. Reserve low scores (<30) for listings that clearly conflict with preferences (wrong area, way over budget, wrong home type).

Return JSON only. No markdown, no explanation outside the JSON.`;

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_FEEDBACK_LENGTH = 500;

type FeedbackRow = {
  listing_id: string;
  feedback_type: string;
  created_at: string;
  neighborhood: string;
  price: number;
  home_type: string;
};

export function buildFeedbackSummary(feedback: FeedbackRow[]): string {
  if (feedback.length === 0) return 'No feedback recorded yet.';

  const grouped = new Map<string, FeedbackRow[]>();
  for (const f of feedback) {
    const existing = grouped.get(f.feedback_type) || [];
    existing.push(f);
    grouped.set(f.feedback_type, existing);
  }

  const lines: string[] = [];

  const templates: Record<string, (rows: FeedbackRow[]) => string> = {
    hide: (rows) => {
      const areas = [...new Set(rows.map((r) => r.neighborhood))].join(', ');
      return `- User has hidden ${rows.length} listing(s) in ${areas}`;
    },
    too_expensive: (rows) => {
      const prices = [...new Set(rows.map((r) => `$${r.price.toLocaleString()}`))].join(', ');
      return `- User marked ${rows.length} listing(s) as too expensive (prices: ${prices})`;
    },
    wrong_area: (rows) => {
      const areas = [...new Set(rows.map((r) => r.neighborhood))].join(', ');
      return `- User flagged ${rows.length} listing(s) as wrong area in ${areas}`;
    },
    wrong_vibe: (rows) => {
      const types = [...new Set(rows.map((r) => r.home_type))].join(', ');
      return `- User flagged ${rows.length} listing(s) as wrong vibe (${types})`;
    },
    love_it: (rows) => {
      const descs = rows.map((r) => `${r.home_type} in ${r.neighborhood}`).join(', ');
      return `- User loved ${rows.length} listing(s): ${descs}`;
    },
    more_like_this: (rows) => {
      const descs = rows.map((r) => `${r.home_type} in ${r.neighborhood}`).join(', ');
      return `- User wants more like ${rows.length} listing(s): ${descs}`;
    },
  };

  for (const [type, rows] of grouped) {
    const template = templates[type];
    if (template) {
      lines.push(template(rows));
    }
  }

  let summary = lines.join('\n');
  if (summary.length > MAX_FEEDBACK_LENGTH) {
    summary = summary.slice(0, MAX_FEEDBACK_LENGTH - 3) + '...';
  }
  return summary;
}

export function buildEvaluationPrompt(
  prefs: UserPreferences,
  candidates: ListingCandidate[],
  feedbackSummary: string,
  previousListings: Array<{
    listing_id: string;
    previous_price?: number;
    current_price?: number;
    change_type: string;
    changed_fields?: Record<string, { old: unknown; new: unknown }>;
  }>,
): string {
  const truncatedCandidates = candidates.map((c) => ({
    listing_id: c.listing.id,
    change_type: c.change_type,
    address: c.listing.address,
    neighborhood: c.listing.neighborhood,
    price: c.listing.price,
    bedrooms: c.listing.bedrooms,
    bathrooms: c.listing.bathrooms,
    sqft: c.listing.sqft,
    home_type: c.listing.home_type,
    features: c.listing.features,
    description:
      c.listing.description.length > MAX_DESCRIPTION_LENGTH
        ? c.listing.description.slice(0, MAX_DESCRIPTION_LENGTH) + '...'
        : c.listing.description,
    url: c.listing.url,
  }));

  let prompt = `Evaluate these Austin rental listings.

User preferences:
${JSON.stringify(prefs, null, 2)}

Recent feedback patterns (last 30 days):
${feedbackSummary}

Listings to evaluate:
${JSON.stringify(truncatedCandidates, null, 2)}`;

  if (previousListings.length > 0) {
    prompt += `\n\nPrevious state for changed listings:\n${JSON.stringify(previousListings, null, 2)}`;
  }

  prompt += `

Return JSON:
{
  "results": [
    {
      "listing_id": "<composite DB id>",
      "match_score": 0-100,
      "notify": true/false,
      "why_match": "...",
      "why_not": "...",
      "alert_type": "new_match|price_drop|back_on_market|improved_listing|ignore"
    }
  ]
}`;

  return prompt;
}

export function parseEvaluationResponse(
  text: string,
): ClaudeEvaluationResult[] | null {
  try {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (!parsed.results || !Array.isArray(parsed.results)) {
      console.error('[evaluate] Parsed JSON but no results array. Keys:', Object.keys(parsed));
      return null;
    }
    return parsed.results;
  } catch (err) {
    console.error('[evaluate] Failed to parse response:', text.slice(0, 200));
    return null;
  }
}

export async function evaluateBatch(
  client: Anthropic,
  prefs: UserPreferences,
  candidates: ListingCandidate[],
  feedbackSummary: string,
  previousListings: Array<{
    listing_id: string;
    previous_price?: number;
    current_price?: number;
    change_type: string;
    changed_fields?: Record<string, { old: unknown; new: unknown }>;
  }>,
): Promise<ClaudeEvaluationResult[] | null> {
  const prompt = buildEvaluationPrompt(
    prefs,
    candidates,
    feedbackSummary,
    previousListings,
  );

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  return parseEvaluationResponse(text);
}
