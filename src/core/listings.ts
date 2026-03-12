import { NormalizedListing, StoredListing, ChangeType } from '../types.js';

const MEANINGFUL_FIELDS: (keyof NormalizedListing)[] = [
  'price',
  'bedrooms',
  'bathrooms',
  'sqft',
  'home_type',
  'status',
];

export function normalizeAddress(address: string): string {
  const trimmed = address.trim().toLowerCase();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return trimmed;
  return `${parts[0]} ${parts[1]}`;
}

export function deduplicateListings(
  listings: NormalizedListing[],
): NormalizedListing[] {
  const seen = new Map<string, NormalizedListing>();
  for (const listing of listings) {
    const key = normalizeAddress(listing.address);
    if (!seen.has(key)) {
      seen.set(key, listing);
    }
  }
  return Array.from(seen.values());
}

export function classifyChange(
  incoming: NormalizedListing,
  existing: StoredListing | null,
): ChangeType | null {
  if (!existing) return 'new';

  if (existing.status === 'delisted' && incoming.status === 'active') {
    return 'back_on_market';
  }

  if (incoming.price < existing.price) {
    return 'price_drop';
  }

  const changes = detectMeaningfulChanges(
    JSON.parse(JSON.stringify(existing)) as NormalizedListing,
    incoming,
  );
  if (changes) return 'updated';

  return null;
}

export function detectMeaningfulChanges(
  oldData: NormalizedListing,
  newData: NormalizedListing,
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of MEANINGFUL_FIELDS) {
    const oldVal = oldData[field];
    const newVal = newData[field];
    if (oldVal !== newVal) {
      changes[field] = { old: oldVal, new: newVal };
    }
  }

  // Check for new features added
  const oldFeatures = new Set(oldData.features);
  const newFeatures = newData.features.filter((f) => !oldFeatures.has(f));
  if (newFeatures.length > 0) {
    changes['features'] = {
      old: oldData.features,
      new: newData.features,
    };
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
