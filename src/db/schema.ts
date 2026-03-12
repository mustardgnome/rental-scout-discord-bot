import Database from 'better-sqlite3';

export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      hidden INTEGER NOT NULL DEFAULT 0,
      evaluation_status TEXT NOT NULL DEFAULT 'pending',
      match_score INTEGER,
      match_reason TEXT,
      mismatch_reason TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_notified_at TEXT,
      missed_runs INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_last_notified_at ON listings(last_notified_at);
    CREATE INDEX IF NOT EXISTS idx_listings_evaluation_status ON listings(evaluation_status);
    CREATE INDEX IF NOT EXISTS idx_listings_hidden ON listings(hidden);

    CREATE TABLE IF NOT EXISTS listing_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      change_type TEXT NOT NULL,
      previous_price INTEGER,
      new_price INTEGER,
      changed_fields TEXT,
      detected_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_listing_history_listing_id ON listing_history(listing_id, detected_at);

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id TEXT NOT NULL REFERENCES listings(id),
      feedback_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_listing_id ON feedback(listing_id);
  `);

  return db;
}
