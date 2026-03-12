import Database from 'better-sqlite3';
import {
  UserPreferences,
  NormalizedListing,
  StoredListing,
  FeedbackType,
} from '../types';

// --- Preferences ---

export function getPreferences(db: Database.Database): UserPreferences | null {
  const row = db.prepare('SELECT data FROM preferences WHERE id = 1').get() as
    | { data: string }
    | undefined;
  if (!row) return null;
  return JSON.parse(row.data);
}

export function savePreferences(
  db: Database.Database,
  prefs: UserPreferences,
): void {
  db.prepare(
    `INSERT INTO preferences (id, data, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(prefs), new Date().toISOString());
}

// --- Listings ---

function compositeKey(source: string, listingId: string): string {
  return `${source}-${listingId}`;
}

function rowToStoredListing(row: Record<string, unknown>): StoredListing {
  const rawData = JSON.parse(row.raw_data as string) as NormalizedListing;
  return {
    ...rawData,
    id: row.id as string,
    price: row.price as number,
    status: row.status as string,
    hidden: (row.hidden as number) === 1,
    evaluation_status: row.evaluation_status as StoredListing['evaluation_status'],
    match_score: row.match_score as number | null,
    match_reason: row.match_reason as string | null,
    mismatch_reason: row.mismatch_reason as string | null,
    first_seen_at: row.first_seen_at as string,
    last_seen_at: row.last_seen_at as string,
    last_notified_at: row.last_notified_at as string | null,
    missed_runs: row.missed_runs as number,
  };
}

export function upsertListing(
  db: Database.Database,
  listing: NormalizedListing,
): string {
  const id = compositeKey(listing.source, listing.listing_id);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO listings (id, source, raw_data, price, status, first_seen_at, last_seen_at, missed_runs)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       raw_data = excluded.raw_data,
       price = excluded.price,
       status = excluded.status,
       last_seen_at = excluded.last_seen_at,
       missed_runs = 0`,
  ).run(id, listing.source, JSON.stringify(listing), listing.price, listing.status, now, now);

  return id;
}

export function getListingById(
  db: Database.Database,
  id: string,
): StoredListing | null {
  const row = db.prepare('SELECT * FROM listings WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return rowToStoredListing(row);
}

export function getListingsByEvaluationStatus(
  db: Database.Database,
  statuses: string[],
): StoredListing[] {
  const placeholders = statuses.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM listings WHERE evaluation_status IN (${placeholders}) AND status = 'active'`,
    )
    .all(...statuses) as Record<string, unknown>[];
  return rows.map(rowToStoredListing);
}

export function getActiveListingsBySource(
  db: Database.Database,
  source: string,
): StoredListing[] {
  const rows = db
    .prepare(`SELECT * FROM listings WHERE source = ? AND status = 'active'`)
    .all(source) as Record<string, unknown>[];
  return rows.map(rowToStoredListing);
}

export function updateListingEvaluation(
  db: Database.Database,
  id: string,
  data: {
    evaluation_status: string;
    match_score: number | null;
    match_reason: string | null;
    mismatch_reason: string | null;
  },
): void {
  db.prepare(
    `UPDATE listings SET evaluation_status = ?, match_score = ?, match_reason = ?, mismatch_reason = ? WHERE id = ?`,
  ).run(data.evaluation_status, data.match_score, data.match_reason, data.mismatch_reason, id);
}

export function updateListingNotified(
  db: Database.Database,
  id: string,
): void {
  db.prepare(
    `UPDATE listings SET last_notified_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), id);
}

export function updateListingHidden(
  db: Database.Database,
  id: string,
  hidden: boolean,
): void {
  db.prepare('UPDATE listings SET hidden = ? WHERE id = ?').run(
    hidden ? 1 : 0,
    id,
  );
}

export function setListingEvaluationStatus(
  db: Database.Database,
  id: string,
  status: string,
): void {
  db.prepare('UPDATE listings SET evaluation_status = ? WHERE id = ?').run(status, id);
}

export function incrementMissedRuns(
  db: Database.Database,
  id: string,
): void {
  db.prepare('UPDATE listings SET missed_runs = missed_runs + 1 WHERE id = ?').run(id);
}

export function resetMissedRuns(
  db: Database.Database,
  id: string,
): void {
  db.prepare('UPDATE listings SET missed_runs = 0 WHERE id = ?').run(id);
}

export function delistStaleListing(
  db: Database.Database,
  id: string,
): void {
  db.prepare(`UPDATE listings SET status = 'delisted' WHERE id = ?`).run(id);
}

// --- Listing History ---

export function addListingHistory(
  db: Database.Database,
  entry: {
    listing_id: string;
    change_type: string;
    previous_price?: number;
    new_price?: number;
    changed_fields?: Record<string, { old: unknown; new: unknown }>;
    detected_at: string;
  },
): void {
  db.prepare(
    `INSERT INTO listing_history (listing_id, change_type, previous_price, new_price, changed_fields, detected_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.listing_id,
    entry.change_type,
    entry.previous_price ?? null,
    entry.new_price ?? null,
    entry.changed_fields ? JSON.stringify(entry.changed_fields) : null,
    entry.detected_at,
  );
}

export function getLatestHistory(
  db: Database.Database,
  listingId: string,
): {
  change_type: string;
  previous_price: number | null;
  new_price: number | null;
  changed_fields: string | null;
  detected_at: string;
} | null {
  const row = db
    .prepare(
      'SELECT * FROM listing_history WHERE listing_id = ? ORDER BY detected_at DESC LIMIT 1',
    )
    .get(listingId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    change_type: row.change_type as string,
    previous_price: row.previous_price as number | null,
    new_price: row.new_price as number | null,
    changed_fields: row.changed_fields as string | null,
    detected_at: row.detected_at as string,
  };
}

// --- Feedback ---

export function addFeedback(
  db: Database.Database,
  entry: { listing_id: string; feedback_type: FeedbackType | string },
): void {
  db.prepare(
    'INSERT INTO feedback (listing_id, feedback_type, created_at) VALUES (?, ?, ?)',
  ).run(entry.listing_id, entry.feedback_type, new Date().toISOString());
}

export function getRecentFeedback(
  db: Database.Database,
  days: number,
): Array<{
  listing_id: string;
  feedback_type: string;
  created_at: string;
  neighborhood: string;
  price: number;
  home_type: string;
}> {
  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const rows = db
    .prepare(
      `SELECT f.listing_id, f.feedback_type, f.created_at,
              json_extract(l.raw_data, '$.neighborhood') as neighborhood,
              l.price,
              json_extract(l.raw_data, '$.home_type') as home_type
       FROM feedback f
       JOIN listings l ON f.listing_id = l.id
       WHERE f.created_at >= ?
       ORDER BY f.created_at DESC`,
    )
    .all(cutoff) as Array<{
    listing_id: string;
    feedback_type: string;
    created_at: string;
    neighborhood: string;
    price: number;
    home_type: string;
  }>;
  return rows;
}
