export interface UserPreferences {
  market: string;
  target_budget: number;
  max_budget: number;
  preferred_areas: string[];
  excluded_areas: string[];
  min_bedrooms: number;
  min_bathrooms: number;
  preferred_home_types: string[];
  must_haves: string[];
  nice_to_haves: string[];
  vibe_preferences: string[];
  alerts_paused: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  market: 'Austin, TX',
  target_budget: 2200,
  max_budget: 2400,
  preferred_areas: ['Zilker', 'Bouldin', 'South Lamar', 'South Austin'],
  excluded_areas: [],
  min_bedrooms: 2,
  min_bathrooms: 1,
  preferred_home_types: ['house', 'duplex', 'townhome', 'condo'],
  must_haves: ['laundry'],
  nice_to_haves: ['yard', 'wood floors', 'good natural light'],
  vibe_preferences: [
    'character over sterile luxury',
    'quieter residential feel',
    'not a giant generic complex',
  ],
  alerts_paused: false,
};

export interface NormalizedListing {
  listing_id: string;
  source: string;
  address: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  home_type: string;
  features: string[];
  description: string;
  image_url: string | null;
  url: string;
  status: string;
}

export interface StoredListing extends NormalizedListing {
  id: string;
  hidden: boolean;
  evaluation_status: 'pending' | 'evaluated' | 'failed';
  match_score: number | null;
  match_reason: string | null;
  mismatch_reason: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_notified_at: string | null;
  missed_runs: number;
}

export type ChangeType = 'new' | 'price_drop' | 'back_on_market' | 'status_change' | 'updated';

export type AlertType = 'new_match' | 'price_drop' | 'back_on_market' | 'improved_listing' | 'ignore';

export type FeedbackType = 'love_it' | 'hide' | 'too_expensive' | 'wrong_area' | 'wrong_vibe' | 'more_like_this';

export interface ClaudeEvaluationResult {
  listing_id: string;
  match_score: number;
  notify: boolean;
  why_match: string;
  why_not: string;
  alert_type: AlertType;
}

export interface ListingCandidate {
  listing: StoredListing;
  change_type: ChangeType;
  previous_price?: number;
  changed_fields?: Record<string, { old: unknown; new: unknown }>;
}

export interface ListingProvider {
  name: string;
  fetchListings(params: {
    city: string;
    stateCode: string;
    limit: number;
    maxPrice?: number;
    minBedrooms?: number;
    minBathrooms?: number;
    homeTypes?: string[];
  }): Promise<NormalizedListing[]>;
}
