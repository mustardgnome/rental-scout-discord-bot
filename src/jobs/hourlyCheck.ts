import Database from 'better-sqlite3';
import Anthropic from '@anthropic-ai/sdk';
import { Client, TextChannel } from 'discord.js';
import { EnvConfig } from '../config/env.js';
import { loadPreferences } from '../core/preferences.js';
import {
  deduplicateListings,
  classifyChange,
  detectMeaningfulChanges,
} from '../core/listings.js';
import { quickFilter, shouldNotify } from '../core/notifications.js';
import {
  evaluateBatch,
  buildFeedbackSummary,
} from '../core/evaluate.js';
import {
  getListingById,
  upsertListing,
  getActiveListingsBySource,
  getListingsByEvaluationStatus,
  updateListingEvaluation,
  updateListingNotified,
  setListingEvaluationStatus,
  incrementMissedRuns,
  delistStaleListing,
  addListingHistory,
  getRecentFeedback,
} from '../db/storage.js';
import { buildAlertEmbed, buildFeedbackButtons } from '../bot/alerts.js';
import {
  NormalizedListing,
  ListingProvider,
  ListingCandidate,
  ChangeType,
} from '../types.js';

let isRunning = false;

const BATCH_SIZE = 20;
const SEND_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runHourlyCheck(
  db: Database.Database,
  providers: ListingProvider[],
  claude: Anthropic,
  discord: Client,
  env: EnvConfig,
): Promise<void> {
  // Step 1: Mutex
  if (isRunning) {
    console.warn('[hourly] Previous run still in progress, skipping');
    return;
  }
  isRunning = true;

  try {
    console.log('[hourly] Starting hourly check...');

    // Step 2: Load preferences
    const prefs = loadPreferences(db);

    // Step 3: Fetch from all providers, track which succeeded
    const allListings: NormalizedListing[] = [];
    const succeededProviders = new Set<string>();

    for (const provider of providers) {
      try {
        const listings = await provider.fetchListings({
          city: 'Austin',
          stateCode: 'TX',
          limit: 200,
          maxPrice: prefs.max_budget,
          minBedrooms: prefs.min_bedrooms,
          minBathrooms: prefs.min_bathrooms,
          homeTypes: prefs.preferred_home_types,
        });
        allListings.push(...listings);
        succeededProviders.add(provider.name);
        console.log(`[hourly] ${provider.name}: fetched ${listings.length} listings`);
      } catch (err) {
        console.error(`[hourly] ${provider.name} failed:`, err);
      }
    }

    if (allListings.length === 0) {
      console.warn('[hourly] No listings fetched from any provider');
      return;
    }

    // Step 4: Deduplicate
    const deduped = deduplicateListings(allListings);
    console.log(`[hourly] ${deduped.length} listings after deduplication`);

    // Step 5: Upsert and classify
    const candidates: ListingCandidate[] = [];
    const now = new Date().toISOString();

    for (const listing of deduped) {
      const compositeId = `${listing.source}-${listing.listing_id}`;
      const existing = getListingById(db, compositeId);
      const changeType = classifyChange(listing, existing);

      // Upsert
      upsertListing(db, listing);

      if (changeType) {
        // Write history
        const historyEntry: Parameters<typeof addListingHistory>[1] = {
          listing_id: compositeId,
          change_type: changeType,
          detected_at: now,
        };

        if (changeType === 'price_drop' && existing) {
          historyEntry.previous_price = existing.price;
          historyEntry.new_price = listing.price;
        }

        let changedFields: Record<string, { old: unknown; new: unknown }> | undefined;
        if (changeType === 'updated' && existing) {
          const rawExisting = JSON.parse(JSON.stringify(existing)) as NormalizedListing;
          changedFields = detectMeaningfulChanges(rawExisting, listing) ?? undefined;
          historyEntry.changed_fields = changedFields;
        }

        addListingHistory(db, historyEntry);

        // Set pending for re-evaluation
        setListingEvaluationStatus(db, compositeId, 'pending');

        const stored = getListingById(db, compositeId)!;
        candidates.push({
          listing: stored,
          change_type: changeType,
          previous_price: changeType === 'price_drop' ? existing?.price : undefined,
          changed_fields: changedFields,
        });
      }
    }

    // Step 6: Detect delisted — use allListings (pre-dedup) to check per source
    for (const providerName of succeededProviders) {
      const activeFromSource = getActiveListingsBySource(db, providerName);
      const fetchedIdsForSource = new Set(
        allListings
          .filter((l) => l.source === providerName)
          .map((l) => `${l.source}-${l.listing_id}`),
      );

      for (const stored of activeFromSource) {
        if (!fetchedIdsForSource.has(stored.id)) {
          incrementMissedRuns(db, stored.id);
          const updated = getListingById(db, stored.id);
          if (updated && updated.missed_runs >= 3) {
            delistStaleListing(db, stored.id);
            console.log(`[hourly] Delisted ${stored.id} after 3 missed runs`);
          }
        }
      }
    }

    // Also pick up previously failed evaluations
    const failedListings = getListingsByEvaluationStatus(db, ['failed']);
    for (const fl of failedListings) {
      if (!candidates.find((c) => c.listing.id === fl.id)) {
        candidates.push({ listing: fl, change_type: 'new' });
      }
    }

    if (prefs.alerts_paused) {
      console.log('[hourly] Alerts paused, skipping evaluation');
      return;
    }

    // Step 7: Quick filter
    const filtered = candidates.filter((c) => {
      const passes = quickFilter(c.listing, prefs);
      if (!passes) {
        updateListingEvaluation(db, c.listing.id, {
          evaluation_status: 'evaluated',
          match_score: 0,
          match_reason: null,
          mismatch_reason: 'Filtered: does not meet basic criteria',
        });
      }
      return passes;
    });

    console.log(`[hourly] ${filtered.length} candidates after quick filter`);

    if (filtered.length === 0) return;

    // Step 8: Batch to Claude
    const feedbackRows = getRecentFeedback(db, 30);
    const feedbackSummary = buildFeedbackSummary(feedbackRows);

    const batches: ListingCandidate[][] = [];
    for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
      batches.push(filtered.slice(i, i + BATCH_SIZE));
    }

    const channel = (await discord.channels.fetch(env.ALERT_CHANNEL_ID)) as TextChannel | null;
    if (!channel) {
      console.error('[hourly] Could not fetch alert channel');
      return;
    }

    for (const batch of batches) {
      try {
        const previousListings = batch
          .filter((c) => ['price_drop', 'back_on_market', 'updated'].includes(c.change_type))
          .map((c) => ({
            listing_id: c.listing.id,
            previous_price: c.previous_price,
            current_price: c.listing.price,
            change_type: c.change_type,
            changed_fields: c.changed_fields,
          }));

        const results = await evaluateBatch(
          claude,
          prefs,
          batch,
          feedbackSummary,
          previousListings,
        );

        if (!results) {
          console.error('[hourly] Claude returned invalid response, marking batch as failed');
          for (const c of batch) {
            setListingEvaluationStatus(db, c.listing.id, 'failed');
          }
          continue;
        }

        // Step 9: Process results — ALL listings, not just notify:true
        for (const result of results) {
          updateListingEvaluation(db, result.listing_id, {
            evaluation_status: 'evaluated',
            match_score: result.match_score,
            match_reason: result.why_match,
            mismatch_reason: result.why_not,
          });

          if (result.notify && result.alert_type !== 'ignore') {
            const stored = getListingById(db, result.listing_id);
            if (!stored) continue;

            const candidate = batch.find((c) => c.listing.id === result.listing_id);
            const changeType = candidate?.change_type || 'new';

            if (!shouldNotify(stored, changeType)) continue;

            try {
              const embed = buildAlertEmbed(stored, result.alert_type, candidate?.previous_price);
              const buttons = buildFeedbackButtons(stored.id);

              await channel.send({
                content: `<@${env.USER_DISCORD_ID}>`,
                embeds: [embed],
                components: buttons,
              });

              updateListingNotified(db, stored.id);
              await sleep(SEND_DELAY_MS);
            } catch (err) {
              console.error(`[hourly] Failed to send alert for ${stored.id}:`, err);
            }
          }
        }
      } catch (err) {
        // Step 10: Mark failed
        console.error('[hourly] Claude batch evaluation failed:', err);
        for (const c of batch) {
          setListingEvaluationStatus(db, c.listing.id, 'failed');
        }
      }
    }

    console.log('[hourly] Hourly check complete');
  } finally {
    isRunning = false;
  }
}
