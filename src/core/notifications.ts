import { StoredListing, UserPreferences, ChangeType } from '../types.js';

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const COOLDOWN_BYPASS_TYPES: ChangeType[] = ['price_drop', 'back_on_market'];

export function quickFilter(
  listing: StoredListing,
  prefs: UserPreferences,
): boolean {
  if (listing.hidden) return false;
  if (listing.price > prefs.max_budget) {
    console.log(`[filter] ${listing.id}: price $${listing.price} > max $${prefs.max_budget}`);
    return false;
  }
  if (listing.bedrooms < prefs.min_bedrooms) {
    console.log(`[filter] ${listing.id}: ${listing.bedrooms}bd < min ${prefs.min_bedrooms}bd`);
    return false;
  }
  if (listing.bathrooms < prefs.min_bathrooms) {
    console.log(`[filter] ${listing.id}: ${listing.bathrooms}ba < min ${prefs.min_bathrooms}ba`);
    return false;
  }

  if (
    prefs.preferred_home_types.length > 0 &&
    !prefs.preferred_home_types.some(
      (t) => t.toLowerCase() === listing.home_type.toLowerCase(),
    )
  ) {
    console.log(`[filter] ${listing.id}: type "${listing.home_type}" not in [${prefs.preferred_home_types}]`);
    return false;
  }

  if (
    prefs.excluded_areas.some((area) =>
      listing.neighborhood.toLowerCase().includes(area.toLowerCase()),
    )
  ) {
    console.log(`[filter] ${listing.id}: neighborhood "${listing.neighborhood}" excluded`);
    return false;
  }

  return true;
}

export function shouldNotify(
  listing: StoredListing,
  changeType: ChangeType,
): boolean {
  if (!listing.last_notified_at) return true;

  if (COOLDOWN_BYPASS_TYPES.includes(changeType)) return true;

  const lastNotified = new Date(listing.last_notified_at).getTime();
  return Date.now() - lastNotified >= COOLDOWN_MS;
}
