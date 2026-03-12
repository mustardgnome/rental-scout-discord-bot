# Rental Scout Bot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal Discord bot that monitors Austin, TX rental listings hourly, evaluates them with Claude, and sends alerts to a dedicated Discord channel.

**Architecture:** Single-process Node.js monolith running in Docker. SQLite for persistence, RapidAPI for listings, Claude for evaluation, discord.js for the bot interface. `node-cron` schedules the hourly job.

**Tech Stack:** TypeScript, Node.js 20, better-sqlite3, discord.js v14, @anthropic-ai/sdk, node-cron, axios, dotenv

**Spec:** `docs/superpowers/specs/2026-03-11-rental-scout-bot-design.md`

---

## Chunk 1: Project Scaffolding & Database

### Task 1: Initialize project and install dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize npm project**

```bash
cd /Users/cole.jones/rental-scout-discord-bot
npm init -y
```

- [ ] **Step 2: Install production dependencies**

```bash
npm install discord.js @anthropic-ai/sdk better-sqlite3 node-cron axios dotenv
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D typescript @types/node @types/better-sqlite3 @types/node-cron vitest
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Create .env.example**

```
ANTHROPIC_API_KEY=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL=./data/rental-scout.db
ALERT_CHANNEL_ID=
USER_DISCORD_ID=

# RapidAPI configuration
RAPIDAPI_KEY=
RAPIDAPI_SOURCES=realty-us
RAPIDAPI_HOST_REALTY_US=realty-in-us.p.rapidapi.com
RAPIDAPI_HOST_ZILLOW=zillow-working-api.p.rapidapi.com
RAPIDAPI_HOST_REALTOR=realtor-com4.p.rapidapi.com
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
data/
.env
*.db
```

- [ ] **Step 7: Add scripts to package.json**

Add these scripts to package.json:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 8: Create src directory structure**

```bash
mkdir -p src/bot/commands src/providers src/core src/jobs src/db src/config
```

- [ ] **Step 9: Commit**

```bash
git init
git add package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "chore: initialize project with dependencies and config"
```

---

### Task 2: Environment config module

**Files:**
- Create: `src/config/env.ts`
- Create: `src/config/env.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/config/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('loadEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns validated config when all required vars are set', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_GUILD_ID = 'test-guild-id';
    process.env.ALERT_CHANNEL_ID = 'test-channel-id';
    process.env.USER_DISCORD_ID = 'test-user-id';
    process.env.RAPIDAPI_KEY = 'test-rapid-key';
    process.env.RAPIDAPI_SOURCES = 'realty-us,zillow';
    process.env.RAPIDAPI_HOST_REALTY_US = 'realty-in-us.p.rapidapi.com';
    process.env.RAPIDAPI_HOST_ZILLOW = 'zillow-working-api.p.rapidapi.com';

    const { loadEnv } = await import('./env.js');
    const config = loadEnv();

    expect(config.ANTHROPIC_API_KEY).toBe('test-key');
    expect(config.DISCORD_BOT_TOKEN).toBe('test-token');
    expect(config.DATABASE_URL).toBe('./data/rental-scout.db');
    expect(config.RAPIDAPI_SOURCES).toEqual(['realty-us', 'zillow']);
    expect(config.rapidapiHost('realty-us')).toBe('realty-in-us.p.rapidapi.com');
    expect(config.rapidapiHost('zillow')).toBe('zillow-working-api.p.rapidapi.com');
  });

  it('throws when a required var is missing', async () => {
    // ANTHROPIC_API_KEY is not set
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_GUILD_ID = 'test-guild-id';
    process.env.ALERT_CHANNEL_ID = 'test-channel-id';
    process.env.USER_DISCORD_ID = 'test-user-id';
    process.env.RAPIDAPI_KEY = 'test-rapid-key';
    process.env.RAPIDAPI_SOURCES = 'realty-us';
    process.env.RAPIDAPI_HOST_REALTY_US = 'host.com';

    const { loadEnv } = await import('./env.js');
    expect(() => loadEnv()).toThrow('ANTHROPIC_API_KEY');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/config/env.test.ts
```
Expected: FAIL — cannot find `./env.js`

- [ ] **Step 3: Write minimal implementation**

Create `src/config/env.ts`:

```typescript
import dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  ANTHROPIC_API_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;
  DATABASE_URL: string;
  ALERT_CHANNEL_ID: string;
  USER_DISCORD_ID: string;
  RAPIDAPI_KEY: string;
  RAPIDAPI_SOURCES: string[];
  rapidapiHost: (source: string) => string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadEnv(): EnvConfig {
  const sources = required('RAPIDAPI_SOURCES')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
    DISCORD_BOT_TOKEN: required('DISCORD_BOT_TOKEN'),
    DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
    DISCORD_GUILD_ID: required('DISCORD_GUILD_ID'),
    DATABASE_URL: process.env.DATABASE_URL || './data/rental-scout.db',
    ALERT_CHANNEL_ID: required('ALERT_CHANNEL_ID'),
    USER_DISCORD_ID: required('USER_DISCORD_ID'),
    RAPIDAPI_KEY: required('RAPIDAPI_KEY'),
    RAPIDAPI_SOURCES: sources,
    rapidapiHost(source: string): string {
      const envKey = `RAPIDAPI_HOST_${source.toUpperCase().replace(/-/g, '_')}`;
      const host = process.env[envKey];
      if (!host) {
        throw new Error(`Missing RapidAPI host env var: ${envKey} for source: ${source}`);
      }
      return host;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/config/env.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/config/env.test.ts
git commit -m "feat: add environment config module with validation"
```

---

### Task 3: TypeScript interfaces

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create shared type definitions**

Create `src/types.ts`:

```typescript
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
  id: string; // composite key: "source-listing_id"
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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript interfaces and types"
```

---

### Task 4: Database schema and storage layer

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/storage.ts`
- Create: `src/db/storage.test.ts`

- [ ] **Step 1: Create database schema**

Create `src/db/schema.ts`:

```typescript
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
```

- [ ] **Step 2: Write storage layer tests**

Create `src/db/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from './schema.js';
import {
  getPreferences,
  savePreferences,
  upsertListing,
  getListingById,
  getListingsByEvaluationStatus,
  updateListingEvaluation,
  updateListingHidden,
  incrementMissedRuns,
  resetMissedRuns,
  delistStaleListing,
  addListingHistory,
  getLatestHistory,
  addFeedback,
  getRecentFeedback,
} from './storage.js';
import { DEFAULT_PREFERENCES, NormalizedListing } from '../types.js';

let db: Database.Database;

const sampleListing: NormalizedListing = {
  listing_id: 'ext-123',
  source: 'rapidapi-realty-us',
  address: '123 Example St',
  neighborhood: 'Zilker',
  price: 2200,
  bedrooms: 2,
  bathrooms: 1,
  sqft: 950,
  home_type: 'duplex',
  features: ['yard', 'laundry'],
  description: 'Nice duplex in South Austin',
  image_url: null,
  url: 'https://example.com/123',
  status: 'active',
};

beforeEach(() => {
  db = initializeDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('preferences', () => {
  it('returns default preferences when none saved', () => {
    const prefs = getPreferences(db);
    expect(prefs).toBeNull();
  });

  it('saves and retrieves preferences', () => {
    savePreferences(db, DEFAULT_PREFERENCES);
    const prefs = getPreferences(db);
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('updates existing preferences', () => {
    savePreferences(db, DEFAULT_PREFERENCES);
    const updated = { ...DEFAULT_PREFERENCES, target_budget: 2500 };
    savePreferences(db, updated);
    const prefs = getPreferences(db);
    expect(prefs?.target_budget).toBe(2500);
  });
});

describe('listings', () => {
  it('inserts a new listing', () => {
    const id = upsertListing(db, sampleListing);
    expect(id).toBe('rapidapi-realty-us-ext-123');
    const stored = getListingById(db, id);
    expect(stored).not.toBeNull();
    expect(stored!.price).toBe(2200);
    expect(stored!.evaluation_status).toBe('pending');
  });

  it('updates an existing listing on re-insert', () => {
    upsertListing(db, sampleListing);
    const updated = { ...sampleListing, price: 2100 };
    const id = upsertListing(db, updated);
    const stored = getListingById(db, id);
    expect(stored!.price).toBe(2100);
    expect(stored!.missed_runs).toBe(0);
  });

  it('queries by evaluation status', () => {
    upsertListing(db, sampleListing);
    const pending = getListingsByEvaluationStatus(db, ['pending']);
    expect(pending).toHaveLength(1);
    const evaluated = getListingsByEvaluationStatus(db, ['evaluated']);
    expect(evaluated).toHaveLength(0);
  });

  it('updates evaluation results', () => {
    const id = upsertListing(db, sampleListing);
    updateListingEvaluation(db, id, {
      evaluation_status: 'evaluated',
      match_score: 78,
      match_reason: 'Good fit',
      mismatch_reason: 'Slightly over budget',
    });
    const stored = getListingById(db, id);
    expect(stored!.match_score).toBe(78);
    expect(stored!.evaluation_status).toBe('evaluated');
  });

  it('sets hidden flag', () => {
    const id = upsertListing(db, sampleListing);
    updateListingHidden(db, id, true);
    const stored = getListingById(db, id);
    expect(stored!.hidden).toBe(true);
  });

  it('increments and resets missed_runs', () => {
    const id = upsertListing(db, sampleListing);
    incrementMissedRuns(db, id);
    incrementMissedRuns(db, id);
    let stored = getListingById(db, id);
    expect(stored!.missed_runs).toBe(2);
    resetMissedRuns(db, id);
    stored = getListingById(db, id);
    expect(stored!.missed_runs).toBe(0);
  });

  it('delists a stale listing', () => {
    const id = upsertListing(db, sampleListing);
    delistStaleListing(db, id);
    const stored = getListingById(db, id);
    expect(stored!.status).toBe('delisted');
  });
});

describe('listing_history', () => {
  it('adds and retrieves history', () => {
    const id = upsertListing(db, sampleListing);
    addListingHistory(db, {
      listing_id: id,
      change_type: 'new',
      detected_at: new Date().toISOString(),
    });
    const history = getLatestHistory(db, id);
    expect(history).not.toBeNull();
    expect(history!.change_type).toBe('new');
  });

  it('stores price drop history', () => {
    const id = upsertListing(db, sampleListing);
    addListingHistory(db, {
      listing_id: id,
      change_type: 'price_drop',
      previous_price: 2400,
      new_price: 2200,
      detected_at: new Date().toISOString(),
    });
    const history = getLatestHistory(db, id);
    expect(history!.previous_price).toBe(2400);
    expect(history!.new_price).toBe(2200);
  });
});

describe('feedback', () => {
  it('adds and retrieves feedback', () => {
    const id = upsertListing(db, sampleListing);
    addFeedback(db, { listing_id: id, feedback_type: 'love_it' });
    const recent = getRecentFeedback(db, 30);
    expect(recent).toHaveLength(1);
    expect(recent[0].feedback_type).toBe('love_it');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/db/storage.test.ts
```
Expected: FAIL — cannot find `./storage.js`

- [ ] **Step 4: Write storage implementation**

Create `src/db/storage.ts`:

```typescript
import Database from 'better-sqlite3';
import {
  UserPreferences,
  NormalizedListing,
  StoredListing,
  FeedbackType,
} from '../types.js';

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
    price: row.price as number, // Use authoritative DB column, not rawData spread
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/db/storage.test.ts
```
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/db/storage.ts src/db/storage.test.ts
git commit -m "feat: add database schema and storage layer"
```

---

## Chunk 2: Core Logic — Listings, Preferences, Notifications

### Task 5: Preferences module

**Files:**
- Create: `src/core/preferences.ts`
- Create: `src/core/preferences.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/preferences.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../db/schema.js';
import { loadPreferences, updatePreferences } from './preferences.js';
import { DEFAULT_PREFERENCES } from '../types.js';

let db: Database.Database;

beforeEach(() => {
  db = initializeDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('loadPreferences', () => {
  it('returns defaults when no preferences saved', () => {
    const prefs = loadPreferences(db);
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('returns saved preferences', () => {
    const custom = { ...DEFAULT_PREFERENCES, target_budget: 3000 };
    updatePreferences(db, custom);
    expect(loadPreferences(db).target_budget).toBe(3000);
  });
});

describe('updatePreferences', () => {
  it('merges partial updates into existing preferences', () => {
    updatePreferences(db, { target_budget: 2600, max_budget: 2800 });
    const prefs = loadPreferences(db);
    expect(prefs.target_budget).toBe(2600);
    expect(prefs.max_budget).toBe(2800);
    expect(prefs.min_bedrooms).toBe(DEFAULT_PREFERENCES.min_bedrooms);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/preferences.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/core/preferences.ts`:

```typescript
import Database from 'better-sqlite3';
import { UserPreferences, DEFAULT_PREFERENCES } from '../types.js';
import { getPreferences, savePreferences } from '../db/storage.js';

export function loadPreferences(db: Database.Database): UserPreferences {
  return getPreferences(db) ?? DEFAULT_PREFERENCES;
}

export function updatePreferences(
  db: Database.Database,
  partial: Partial<UserPreferences>,
): UserPreferences {
  const current = loadPreferences(db);
  const merged = { ...current, ...partial };
  savePreferences(db, merged);
  return merged;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/preferences.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/preferences.ts src/core/preferences.test.ts
git commit -m "feat: add preferences module with defaults and partial updates"
```

---

### Task 6: Listing comparison and classification

**Files:**
- Create: `src/core/listings.ts`
- Create: `src/core/listings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/listings.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeAddress,
  deduplicateListings,
  classifyChange,
  detectMeaningfulChanges,
} from './listings.js';
import { NormalizedListing, StoredListing } from '../types.js';

const makeListing = (overrides: Partial<NormalizedListing> = {}): NormalizedListing => ({
  listing_id: 'ext-1',
  source: 'rapidapi-realty-us',
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
  ...overrides,
});

describe('normalizeAddress', () => {
  it('normalizes to lowercase street number + first word', () => {
    expect(normalizeAddress('123 Example St')).toBe('123 example');
    expect(normalizeAddress('123 Example Street')).toBe('123 example');
    expect(normalizeAddress('  123  Example  Blvd, Unit A ')).toBe('123 example');
  });
});

describe('deduplicateListings', () => {
  it('removes duplicates by normalized address', () => {
    const listings = [
      makeListing({ listing_id: '1', source: 'source-a', address: '123 Example St' }),
      makeListing({ listing_id: '2', source: 'source-b', address: '123 Example Street' }),
      makeListing({ listing_id: '3', source: 'source-a', address: '456 Other Ave' }),
    ];
    const deduped = deduplicateListings(listings);
    expect(deduped).toHaveLength(2);
  });
});

describe('classifyChange', () => {
  const makeStored = (overrides: Partial<StoredListing> = {}): StoredListing => ({
    ...makeListing(),
    id: 'rapidapi-realty-us-ext-1',
    hidden: false,
    evaluation_status: 'evaluated',
    match_score: 50,
    match_reason: null,
    mismatch_reason: null,
    first_seen_at: '2026-01-01T00:00:00Z',
    last_seen_at: '2026-01-01T00:00:00Z',
    last_notified_at: null,
    missed_runs: 0,
    ...overrides,
  });

  it('returns "new" when no existing listing', () => {
    expect(classifyChange(makeListing(), null)).toBe('new');
  });

  it('returns "price_drop" when price decreased', () => {
    const existing = makeStored({ price: 2400 });
    const incoming = makeListing({ price: 2200 });
    expect(classifyChange(incoming, existing)).toBe('price_drop');
  });

  it('returns "back_on_market" when was delisted', () => {
    const existing = makeStored({ status: 'delisted' });
    expect(classifyChange(makeListing(), existing)).toBe('back_on_market');
  });

  it('returns "updated" when meaningful fields change', () => {
    const existing = makeStored({ sqft: 900 });
    const incoming = makeListing({ sqft: 950 });
    expect(classifyChange(incoming, existing)).toBe('updated');
  });

  it('returns null when no meaningful change', () => {
    const existing = makeStored();
    const incoming = makeListing({ description: 'Updated description' });
    expect(classifyChange(incoming, existing)).toBeNull();
  });
});

describe('detectMeaningfulChanges', () => {
  it('detects changed fields', () => {
    const oldData: NormalizedListing = makeListing({ price: 2400, sqft: 900 });
    const newData: NormalizedListing = makeListing({ price: 2200, sqft: 950 });
    const changes = detectMeaningfulChanges(oldData, newData);
    expect(changes).toHaveProperty('price');
    expect(changes).toHaveProperty('sqft');
    expect(changes!.price).toEqual({ old: 2400, new: 2200 });
  });

  it('returns null when no meaningful changes', () => {
    const data = makeListing();
    expect(detectMeaningfulChanges(data, { ...data, description: 'new' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/listings.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/core/listings.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/listings.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/listings.ts src/core/listings.test.ts
git commit -m "feat: add listing comparison, deduplication, and change classification"
```

---

### Task 7: Notification rules and cooldowns

**Files:**
- Create: `src/core/notifications.ts`
- Create: `src/core/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/notifications.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldNotify, quickFilter } from './notifications.js';
import { StoredListing, UserPreferences, DEFAULT_PREFERENCES, ChangeType } from '../types.js';

const makeStored = (overrides: Partial<StoredListing> = {}): StoredListing => ({
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
  ...overrides,
});

describe('quickFilter', () => {
  it('filters out listings above max budget', () => {
    const listing = makeStored({ price: 3000 });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings below min bedrooms', () => {
    const listing = makeStored({ bedrooms: 1 });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings below min bathrooms', () => {
    const listing = makeStored({ bathrooms: 0 });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings with wrong home type', () => {
    const listing = makeStored({ home_type: 'apartment' });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('filters out listings in excluded areas', () => {
    const prefs = { ...DEFAULT_PREFERENCES, excluded_areas: ['East Austin'] };
    const listing = makeStored({ neighborhood: 'East Austin' });
    expect(quickFilter(listing, prefs)).toBe(false);
  });

  it('filters out hidden listings', () => {
    const listing = makeStored({ hidden: true });
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(false);
  });

  it('passes valid listings', () => {
    const listing = makeStored();
    expect(quickFilter(listing, DEFAULT_PREFERENCES)).toBe(true);
  });
});

describe('shouldNotify', () => {
  it('allows notification when never notified', () => {
    expect(shouldNotify(makeStored(), 'new')).toBe(true);
  });

  it('blocks notification within 24h cooldown', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: recent });
    expect(shouldNotify(listing, 'new')).toBe(false);
  });

  it('allows price_drop within cooldown', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: recent });
    expect(shouldNotify(listing, 'price_drop')).toBe(true);
  });

  it('allows back_on_market within cooldown', () => {
    const recent = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: recent });
    expect(shouldNotify(listing, 'back_on_market')).toBe(true);
  });

  it('allows notification after 24h cooldown expires', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const listing = makeStored({ last_notified_at: old });
    expect(shouldNotify(listing, 'new')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/notifications.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/core/notifications.ts`:

```typescript
import { StoredListing, UserPreferences, ChangeType } from '../types.js';

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const COOLDOWN_BYPASS_TYPES: ChangeType[] = ['price_drop', 'back_on_market'];

export function quickFilter(
  listing: StoredListing,
  prefs: UserPreferences,
): boolean {
  if (listing.hidden) return false;
  if (listing.price > prefs.max_budget) return false;
  if (listing.bedrooms < prefs.min_bedrooms) return false;
  if (listing.bathrooms < prefs.min_bathrooms) return false;

  if (
    prefs.preferred_home_types.length > 0 &&
    !prefs.preferred_home_types.some(
      (t) => t.toLowerCase() === listing.home_type.toLowerCase(),
    )
  ) {
    return false;
  }

  if (
    prefs.excluded_areas.some((area) =>
      listing.neighborhood.toLowerCase().includes(area.toLowerCase()),
    )
  ) {
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/notifications.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/notifications.ts src/core/notifications.test.ts
git commit -m "feat: add notification rules with quick filter and cooldown logic"
```

---

## Chunk 3: Claude Evaluation & Provider Layer

### Task 8: Claude evaluation module

**Files:**
- Create: `src/core/evaluate.ts`
- Create: `src/core/evaluate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/evaluate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildFeedbackSummary,
  buildEvaluationPrompt,
  parseEvaluationResponse,
  SYSTEM_PROMPT,
} from './evaluate.js';

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
    const prefs = { market: 'Austin, TX', target_budget: 2200 };
    const listings = [{ listing_id: 'test-1', price: 2200 }];
    const prompt = buildEvaluationPrompt(
      prefs as any,
      listings as any,
      'No feedback recorded yet.',
      [],
    );
    expect(prompt).toContain('Austin, TX');
    expect(prompt).toContain('test-1');
    expect(prompt).toContain('No feedback recorded yet.');
  });

  it('truncates listing descriptions to 300 chars', () => {
    const longDesc = 'x'.repeat(500);
    const listings = [{
      listing_id: 'test-1',
      description: longDesc,
      price: 2200,
    }];
    const prompt = buildEvaluationPrompt(
      {} as any,
      listings as any,
      '',
      [],
    );
    expect(prompt).not.toContain('x'.repeat(500));
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/evaluate.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/core/evaluate.ts`:

```typescript
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
    const parsed = JSON.parse(text);
    if (!parsed.results || !Array.isArray(parsed.results)) return null;
    return parsed.results;
  } catch {
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
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/core/evaluate.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/evaluate.ts src/core/evaluate.test.ts
git commit -m "feat: add Claude evaluation module with prompt builder and response parser"
```

---

### Task 9: RapidAPI provider adapter

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/providers/rapidapi.ts`
- Create: `src/providers/rapidapi.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/providers/rapidapi.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { normalizeRealtyUsListing, createRapidApiProvider } from './rapidapi.js';

describe('normalizeRealtyUsListing', () => {
  it('normalizes a raw Realty in US API response to NormalizedListing', () => {
    const raw = {
      property_id: 'M1234567890',
      list_price: 2200,
      description: {
        beds: 2,
        baths: 1,
        sqft: 950,
        type: 'duplex',
        text: 'Nice duplex in South Austin with wood floors and yard.',
      },
      location: {
        address: {
          line: '123 Example St',
          city: 'Austin',
          state_code: 'TX',
          postal_code: '78704',
        },
        neighborhoods: [{ name: 'Zilker' }],
      },
      photos: [{ href: 'https://photos.example.com/1.jpg' }],
      href: 'https://www.realtor.com/listing/123',
      status: 'for_rent',
      tags: ['laundry', 'yard'],
    };

    const listing = normalizeRealtyUsListing(raw);
    expect(listing.listing_id).toBe('M1234567890');
    expect(listing.source).toBe('rapidapi-realty-us');
    expect(listing.price).toBe(2200);
    expect(listing.bedrooms).toBe(2);
    expect(listing.neighborhood).toBe('Zilker');
    expect(listing.image_url).toBe('https://photos.example.com/1.jpg');
    expect(listing.status).toBe('active');
  });

  it('handles missing optional fields gracefully', () => {
    const raw = {
      property_id: 'M9999',
      list_price: 1800,
      description: { beds: 1, baths: 1, type: 'apartment' },
      location: {
        address: { line: '456 Other Ave', city: 'Austin', state_code: 'TX', postal_code: '78701' },
      },
      status: 'for_rent',
    };

    const listing = normalizeRealtyUsListing(raw);
    expect(listing.sqft).toBeNull();
    expect(listing.neighborhood).toBe('');
    expect(listing.image_url).toBeNull();
    expect(listing.features).toEqual([]);
    expect(listing.description).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/providers/rapidapi.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write provider types**

Create `src/providers/types.ts`:

```typescript
export { ListingProvider, NormalizedListing } from '../types.js';
```

- [ ] **Step 4: Write RapidAPI provider implementation**

Create `src/providers/rapidapi.ts`:

```typescript
import axios from 'axios';
import { NormalizedListing, ListingProvider } from '../types.js';

export function normalizeRealtyUsListing(raw: any): NormalizedListing {
  const addr = raw.location?.address || {};
  const neighborhoods = raw.location?.neighborhoods || [];
  const desc = raw.description || {};

  return {
    listing_id: raw.property_id || '',
    source: 'rapidapi-realty-us',
    address: `${addr.line || ''}, ${addr.city || ''}, ${addr.state_code || ''} ${addr.postal_code || ''}`.trim(),
    neighborhood: neighborhoods[0]?.name || '',
    price: raw.list_price || 0,
    bedrooms: desc.beds || 0,
    bathrooms: desc.baths || 0,
    sqft: desc.sqft || null,
    home_type: desc.type || 'unknown',
    features: raw.tags || [],
    description: desc.text || '',
    image_url: raw.photos?.[0]?.href || null,
    url: raw.href || '',
    status: raw.status === 'for_rent' ? 'active' : raw.status || 'active',
  };
}

export function createRapidApiProvider(
  apiKey: string,
  host: string,
  sourceName: string,
): ListingProvider {
  return {
    name: `rapidapi-${sourceName}`,

    async fetchListings(params) {
      const { city, stateCode, limit, maxPrice, minBedrooms, minBathrooms } =
        params;

      const queryParams: Record<string, string | number> = {
        city,
        state_code: stateCode,
        limit,
        offset: 0,
        sort: 'newest',
      };

      if (maxPrice) queryParams.price_max = maxPrice;
      if (minBedrooms) queryParams.beds_min = minBedrooms;
      if (minBathrooms) queryParams.baths_min = minBathrooms;

      const response = await axios.get(
        'https://' + host + '/properties/v3/list',
        {
          params: queryParams,
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': host,
          },
          timeout: 30000,
        },
      );

      const properties = response.data?.data?.home_search?.results || [];
      return properties.map(normalizeRealtyUsListing);
    },
  };
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/providers/rapidapi.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/providers/types.ts src/providers/rapidapi.ts src/providers/rapidapi.test.ts
git commit -m "feat: add RapidAPI provider adapter with Realty in US normalizer"
```

---

## Chunk 4: Discord Bot — Commands, Alerts, Buttons

### Task 10: Discord alert formatting

**Files:**
- Create: `src/bot/alerts.ts`
- Create: `src/bot/alerts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/bot/alerts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildAlertEmbed, buildFeedbackButtons } from './alerts.js';
import { StoredListing, AlertType } from '../types.js';

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
  it('returns two action rows with 6 total buttons', () => {
    const rows = buildFeedbackButtons('test-listing-id');
    expect(rows).toHaveLength(2);
    // Row 1: 5 buttons, Row 2: 1 button
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/bot/alerts.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/bot/alerts.ts`:

```typescript
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { StoredListing, AlertType } from '../types.js';

const ALERT_TITLES: Record<string, string> = {
  new_match: 'New Match',
  price_drop: 'Price Drop',
  back_on_market: 'Back on Market',
  improved_listing: 'Listing Updated',
};

const ALERT_COLORS: Record<string, number> = {
  new_match: 0x22c55e,      // green
  price_drop: 0x3b82f6,     // blue
  back_on_market: 0xf59e0b, // amber
  improved_listing: 0x8b5cf6, // purple
};

export function buildAlertEmbed(
  listing: StoredListing,
  alertType: AlertType,
  previousPrice?: number,
): EmbedBuilder {
  const title = `${ALERT_TITLES[alertType] || 'Alert'} — ${capitalize(listing.home_type)} in ${listing.neighborhood || 'Austin'}`;

  let priceDisplay = `$${listing.price.toLocaleString()}/mo`;
  if (alertType === 'price_drop' && previousPrice) {
    priceDisplay = `~~$${previousPrice.toLocaleString()}~~ → $${listing.price.toLocaleString()}/mo`;
  }

  const sqftDisplay = listing.sqft ? `  |  ${listing.sqft.toLocaleString()} sqft` : '';

  const lines = [
    `**${priceDisplay}**  |  ${listing.bedrooms}bd/${listing.bathrooms}ba${sqftDisplay}`,
    `${listing.address}`,
    `${capitalize(listing.home_type)}`,
    '',
  ];

  if (listing.match_reason) {
    lines.push(`**Why it matches:**`);
    lines.push(listing.match_reason);
    lines.push('');
  }

  if (listing.mismatch_reason) {
    lines.push(`**Heads up:**`);
    lines.push(listing.mismatch_reason);
    lines.push('');
  }

  if (listing.match_score !== null) {
    lines.push(`**Score:** ${listing.match_score}/100`);
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setURL(listing.url)
    .setColor(ALERT_COLORS[alertType] || 0x6b7280);

  if (listing.image_url) {
    embed.setThumbnail(listing.image_url);
  }

  return embed;
}

export function buildFeedbackButtons(
  listingId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`feedback:love_it:${listingId}`)
      .setLabel('Love it')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`feedback:hide:${listingId}`)
      .setLabel('Hide')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`feedback:too_expensive:${listingId}`)
      .setLabel('Too expensive')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`feedback:wrong_area:${listingId}`)
      .setLabel('Wrong area')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`feedback:wrong_vibe:${listingId}`)
      .setLabel('Wrong vibe')
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`feedback:more_like_this:${listingId}`)
      .setLabel('More like this')
      .setStyle(ButtonStyle.Primary),
  );

  return [row1, row2];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/bot/alerts.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bot/alerts.ts src/bot/alerts.test.ts
git commit -m "feat: add Discord alert embed builder with feedback buttons"
```

---

### Task 11: Feedback button handler

**Files:**
- Create: `src/bot/buttons.ts`
- Create: `src/bot/buttons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/bot/buttons.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/bot/buttons.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/bot/buttons.ts`:

```typescript
import { ButtonInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import { FeedbackType } from '../types.js';
import { addFeedback, updateListingHidden } from '../db/storage.js';

const VALID_FEEDBACK_TYPES: Set<string> = new Set([
  'love_it',
  'hide',
  'too_expensive',
  'wrong_area',
  'wrong_vibe',
  'more_like_this',
]);

export function parseFeedbackCustomId(
  customId: string,
): { feedbackType: string; listingId: string } | null {
  if (!customId.startsWith('feedback:')) return null;
  const parts = customId.split(':');
  if (parts.length < 3) return null;
  const feedbackType = parts[1];
  const listingId = parts.slice(2).join(':');
  if (!VALID_FEEDBACK_TYPES.has(feedbackType)) return null;
  return { feedbackType, listingId };
}

export async function handleFeedbackButton(
  interaction: ButtonInteraction,
  db: Database.Database,
  userId: string,
): Promise<void> {
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: 'This bot is configured for a specific user.',
      ephemeral: true,
    });
    return;
  }

  const parsed = parseFeedbackCustomId(interaction.customId);
  if (!parsed) return;

  const { feedbackType, listingId } = parsed;

  addFeedback(db, {
    listing_id: listingId,
    feedback_type: feedbackType as FeedbackType,
  });

  if (feedbackType === 'hide') {
    updateListingHidden(db, listingId, true);
  }

  // Disable the clicked button and mark it
  const updatedRows = interaction.message.components.map((row) => {
    const newRow = { ...row.toJSON() };
    newRow.components = newRow.components.map((comp: any) => {
      if (comp.custom_id === interaction.customId) {
        return { ...comp, disabled: true, label: `✓ ${comp.label}` };
      }
      return { ...comp, disabled: true };
    });
    return newRow;
  });

  await interaction.update({ components: updatedRows as any });
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/bot/buttons.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bot/buttons.ts src/bot/buttons.test.ts
git commit -m "feat: add feedback button handler with hide support"
```

---

### Task 12: Slash command registration and handlers

**Files:**
- Create: `src/bot/register.ts`
- Create: `src/bot/commands/start.ts`
- Create: `src/bot/commands/preferences.ts`
- Create: `src/bot/commands/alerts.ts`

- [ ] **Step 1: Create command registration module**

Create `src/bot/register.ts`:

```typescript
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export function buildCommands(): SlashCommandBuilder[] {
  return [
    new SlashCommandBuilder()
      .setName('start')
      .setDescription('Initialize the bot with default preferences'),

    new SlashCommandBuilder()
      .setName('show-preferences')
      .setDescription('Show your current rental preferences'),

    new SlashCommandBuilder()
      .setName('set-budget')
      .setDescription('Set your budget range')
      .addIntegerOption((o) =>
        o.setName('target').setDescription('Target monthly budget').setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName('max').setDescription('Max monthly budget').setRequired(true),
      ) as SlashCommandBuilder,

    new SlashCommandBuilder()
      .setName('set-areas')
      .setDescription('Set your preferred and excluded areas')
      .addStringOption((o) =>
        o.setName('preferred').setDescription('Comma-separated preferred areas'),
      )
      .addStringOption((o) =>
        o.setName('excluded').setDescription('Comma-separated excluded areas'),
      ) as SlashCommandBuilder,

    new SlashCommandBuilder()
      .setName('set-preferences')
      .setDescription('Update specific preferences')
      .addIntegerOption((o) => o.setName('bedrooms').setDescription('Minimum bedrooms'))
      .addIntegerOption((o) => o.setName('bathrooms').setDescription('Minimum bathrooms'))
      .addStringOption((o) =>
        o.setName('home-types').setDescription('Comma-separated home types'),
      )
      .addStringOption((o) =>
        o.setName('must-haves').setDescription('Comma-separated must-have features'),
      )
      .addStringOption((o) =>
        o.setName('nice-to-haves').setDescription('Comma-separated nice-to-have features'),
      )
      .addStringOption((o) =>
        o.setName('vibes').setDescription('Comma-separated vibe preferences'),
      ) as SlashCommandBuilder,

    new SlashCommandBuilder()
      .setName('pause-alerts')
      .setDescription('Pause rental alerts (bot still tracks listings)'),

    new SlashCommandBuilder()
      .setName('resume-alerts')
      .setDescription('Resume rental alerts'),

    new SlashCommandBuilder()
      .setName('test-alert')
      .setDescription('Send a test alert to verify the bot is working'),
  ];
}

export async function registerCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildCommands().map((c) => c.toJSON());

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
}
```

- [ ] **Step 2: Create start command handler**

Create `src/bot/commands/start.ts`:

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { loadPreferences, updatePreferences } from '../../core/preferences.js';
import { getPreferences } from '../../db/storage.js';
import { DEFAULT_PREFERENCES } from '../../types.js';

export async function handleStart(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  if (getPreferences(db) === null) {
    // First time — save defaults to DB
    updatePreferences(db, DEFAULT_PREFERENCES);
  }

  const prefs = loadPreferences(db);
  const embed = new EmbedBuilder()
    .setTitle('Rental Scout Bot — Ready!')
    .setDescription(
      `Monitoring **${prefs.market}** for rentals.\n` +
        `Budget: $${prefs.target_budget} - $${prefs.max_budget}/mo\n` +
        `Areas: ${prefs.preferred_areas.join(', ') || 'Any'}\n` +
        `Min: ${prefs.min_bedrooms}bd/${prefs.min_bathrooms}ba\n\n` +
        `Use \`/show-preferences\` to see full settings.\n` +
        `Use \`/set-budget\`, \`/set-areas\`, or \`/set-preferences\` to customize.`,
    )
    .setColor(0x22c55e);

  await interaction.reply({ embeds: [embed] });
}
```

- [ ] **Step 3: Create preferences command handlers**

Create `src/bot/commands/preferences.ts`:

```typescript
import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import Database from 'better-sqlite3';
import { loadPreferences, updatePreferences } from '../../core/preferences.js';

export async function handleShowPreferences(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const prefs = loadPreferences(db);

  const embed = new EmbedBuilder()
    .setTitle('Your Rental Preferences')
    .addFields(
      { name: 'Market', value: prefs.market, inline: true },
      { name: 'Budget', value: `$${prefs.target_budget} - $${prefs.max_budget}/mo`, inline: true },
      { name: 'Min Beds/Baths', value: `${prefs.min_bedrooms}bd / ${prefs.min_bathrooms}ba`, inline: true },
      { name: 'Preferred Areas', value: prefs.preferred_areas.join(', ') || 'Any' },
      { name: 'Excluded Areas', value: prefs.excluded_areas.join(', ') || 'None' },
      { name: 'Home Types', value: prefs.preferred_home_types.join(', ') || 'Any' },
      { name: 'Must-Haves', value: prefs.must_haves.join(', ') || 'None' },
      { name: 'Nice-to-Haves', value: prefs.nice_to_haves.join(', ') || 'None' },
      { name: 'Vibe', value: prefs.vibe_preferences.join(', ') || 'None' },
      { name: 'Alerts', value: prefs.alerts_paused ? 'Paused' : 'Active', inline: true },
    )
    .setColor(0x3b82f6);

  await interaction.reply({ embeds: [embed] });
}

function parseCSV(value: string | null): string[] | undefined {
  if (!value) return undefined;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function handleSetBudget(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const target = interaction.options.getInteger('target', true);
  const max = interaction.options.getInteger('max', true);

  if (target > max) {
    await interaction.reply({
      content: 'Target budget cannot be greater than max budget.',
      ephemeral: true,
    });
    return;
  }

  updatePreferences(db, { target_budget: target, max_budget: max });
  await interaction.reply(`Budget updated: $${target} - $${max}/mo`);
}

export async function handleSetAreas(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const preferred = parseCSV(interaction.options.getString('preferred'));
  const excluded = parseCSV(interaction.options.getString('excluded'));

  const updates: Record<string, string[]> = {};
  if (preferred) updates.preferred_areas = preferred;
  if (excluded !== undefined) updates.excluded_areas = excluded ?? [];

  updatePreferences(db, updates as any);

  const parts: string[] = [];
  if (preferred) parts.push(`Preferred: ${preferred.join(', ')}`);
  if (excluded !== undefined) parts.push(`Excluded: ${(excluded ?? []).join(', ') || 'None'}`);

  await interaction.reply(`Areas updated. ${parts.join(' | ')}`);
}

export async function handleSetPreferences(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  const bedrooms = interaction.options.getInteger('bedrooms');
  const bathrooms = interaction.options.getInteger('bathrooms');
  const homeTypes = parseCSV(interaction.options.getString('home-types'));
  const mustHaves = parseCSV(interaction.options.getString('must-haves'));
  const niceToHaves = parseCSV(interaction.options.getString('nice-to-haves'));
  const vibes = parseCSV(interaction.options.getString('vibes'));

  if (bedrooms !== null) updates.min_bedrooms = bedrooms;
  if (bathrooms !== null) updates.min_bathrooms = bathrooms;
  if (homeTypes) updates.preferred_home_types = homeTypes;
  if (mustHaves) updates.must_haves = mustHaves;
  if (niceToHaves) updates.nice_to_haves = niceToHaves;
  if (vibes) updates.vibe_preferences = vibes;

  if (Object.keys(updates).length === 0) {
    await interaction.reply({
      content: 'No preferences provided. Use the options to set specific preferences.',
      ephemeral: true,
    });
    return;
  }

  updatePreferences(db, updates as any);
  await interaction.reply(`Preferences updated: ${Object.keys(updates).join(', ')}`);
}
```

- [ ] **Step 4: Create alerts command handlers**

Create `src/bot/commands/alerts.ts`:

```typescript
import { ChatInputCommandInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import { updatePreferences, loadPreferences } from '../../core/preferences.js';
import { buildAlertEmbed, buildFeedbackButtons } from '../alerts.js';
import { StoredListing } from '../../types.js';

export async function handlePauseAlerts(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  updatePreferences(db, { alerts_paused: true });
  await interaction.reply('Alerts paused. The bot will still track listings in the background. Use `/resume-alerts` to resume.');
}

export async function handleResumeAlerts(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
): Promise<void> {
  updatePreferences(db, { alerts_paused: false });
  await interaction.reply('Alerts resumed! You will be notified about matching listings.');
}

export async function handleTestAlert(
  interaction: ChatInputCommandInteraction,
  db: Database.Database,
  userId: string,
): Promise<void> {
  const fakeListing: StoredListing = {
    listing_id: 'test-123',
    source: 'test',
    id: 'test-test-123',
    address: '123 Test St, Austin, TX 78704',
    neighborhood: 'Zilker',
    price: 2295,
    bedrooms: 2,
    bathrooms: 1,
    sqft: 950,
    home_type: 'duplex',
    features: ['yard', 'laundry', 'wood floors'],
    description: 'This is a test alert to verify formatting.',
    image_url: null,
    url: 'https://example.com/test',
    status: 'active',
    hidden: false,
    evaluation_status: 'evaluated',
    match_score: 78,
    match_reason: 'Good South Austin area fit, duplex format, and more character than a typical generic apartment.',
    mismatch_reason: 'Slightly above target budget and kitchen looks dated.',
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    last_notified_at: null,
    missed_runs: 0,
  };

  const embed = buildAlertEmbed(fakeListing, 'new_match');
  const buttons = buildFeedbackButtons(fakeListing.id);

  await interaction.reply({
    content: `<@${userId}> Test alert:`,
    embeds: [embed],
    components: buttons,
  });
}
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/bot/register.ts src/bot/commands/start.ts src/bot/commands/preferences.ts src/bot/commands/alerts.ts
git commit -m "feat: add slash commands — start, preferences, budget, areas, pause/resume, test-alert"
```

---

## Chunk 5: Hourly Worker & Entry Point

### Task 13: Hourly check job

**Files:**
- Create: `src/jobs/hourlyCheck.ts`

- [ ] **Step 1: Write the hourly check implementation**

Create `src/jobs/hourlyCheck.ts`:

```typescript
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
  getLatestHistory,
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
const SEND_DELAY_MS = 1100; // ~5 per 5 seconds

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

    // Step 6: Detect delisted
    // Use allListings (pre-dedup) to check presence per source, so dedup doesn't
    // cause false delistings for the same property tracked under multiple sources.
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
        // Mark as evaluated with score 0
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
        // Build previous listings context
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

        // Step 9: Process results
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
              // Don't update last_notified_at — will retry next run
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
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/jobs/hourlyCheck.ts
git commit -m "feat: add hourly check job with full listing pipeline"
```

---

### Task 14: Entry point and bot setup

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write the entry point**

Create `src/index.ts`:

```typescript
import { Client, GatewayIntentBits, Events } from 'discord.js';
import cron from 'node-cron';
import Anthropic from '@anthropic-ai/sdk';
import { loadEnv } from './config/env.js';
import { initializeDatabase } from './db/schema.js';
import { registerCommands } from './bot/register.js';
import { handleFeedbackButton } from './bot/buttons.js';
import { handleStart } from './bot/commands/start.js';
import {
  handleShowPreferences,
  handleSetBudget,
  handleSetAreas,
  handleSetPreferences,
} from './bot/commands/preferences.js';
import {
  handlePauseAlerts,
  handleResumeAlerts,
  handleTestAlert,
} from './bot/commands/alerts.js';
import { createRapidApiProvider } from './providers/rapidapi.js';
import { runHourlyCheck } from './jobs/hourlyCheck.js';
import { ListingProvider } from './types.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

async function main(): Promise<void> {
  // Step 1: Load env
  const env = loadEnv();
  console.log('[boot] Environment loaded');

  // Step 2: Initialize DB
  mkdirSync(dirname(env.DATABASE_URL), { recursive: true });
  const db = initializeDatabase(env.DATABASE_URL);
  console.log('[boot] Database initialized');

  // Step 3: Register commands (non-fatal)
  try {
    await registerCommands(
      env.DISCORD_BOT_TOKEN,
      env.DISCORD_CLIENT_ID,
      env.DISCORD_GUILD_ID,
    );
    console.log('[boot] Slash commands registered');
  } catch (err) {
    console.error('[boot] Failed to register commands (non-fatal):', err);
  }

  // Step 4: Set up Discord client
  const discord = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  // Command handler
  discord.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      // Access control
      if (interaction.user.id !== env.USER_DISCORD_ID) {
        await interaction.reply({
          content: 'This bot is configured for a specific user.',
          ephemeral: true,
        });
        return;
      }

      try {
        switch (interaction.commandName) {
          case 'start':
            await handleStart(interaction, db);
            break;
          case 'show-preferences':
            await handleShowPreferences(interaction, db);
            break;
          case 'set-budget':
            await handleSetBudget(interaction, db);
            break;
          case 'set-areas':
            await handleSetAreas(interaction, db);
            break;
          case 'set-preferences':
            await handleSetPreferences(interaction, db);
            break;
          case 'pause-alerts':
            await handlePauseAlerts(interaction, db);
            break;
          case 'resume-alerts':
            await handleResumeAlerts(interaction, db);
            break;
          case 'test-alert':
            await handleTestAlert(interaction, db, env.USER_DISCORD_ID);
            break;
        }
      } catch (err) {
        console.error(`[bot] Error handling /${interaction.commandName}:`, err);
        if (!interaction.replied) {
          await interaction.reply({
            content: 'Something went wrong. Check the logs.',
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.isButton()) {
      await handleFeedbackButton(interaction, db, env.USER_DISCORD_ID);
    }
  });

  // Step 5: Login
  await discord.login(env.DISCORD_BOT_TOKEN);
  console.log('[boot] Discord bot logged in');

  // Set up providers
  const providers: ListingProvider[] = env.RAPIDAPI_SOURCES.map((source) =>
    createRapidApiProvider(env.RAPIDAPI_KEY, env.rapidapiHost(source), source),
  );

  // Claude client
  const claude = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  // Step 6: Schedule hourly job
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Triggering hourly check');
    await runHourlyCheck(db, providers, claude, discord, env);
  });

  console.log('[boot] Hourly job scheduled. Bot is ready!');

  // Graceful shutdown
  const shutdown = () => {
    console.log('[shutdown] Shutting down...');
    discord.destroy();
    db.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Build the project**

```bash
npm run build
```
Expected: compiles to `dist/`

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add entry point with bot setup, command routing, and cron scheduling"
```

---

## Chunk 6: Docker & Final Integration

### Task 15: Dockerfile and docker-compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  rental-scout:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
```

- [ ] **Step 3: Verify Docker build**

```bash
docker build -t rental-scout-bot .
```
Expected: builds successfully

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfile and docker-compose for containerized deployment"
```

---

### Task 16: Vitest config

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: true,
  },
});
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest configuration"
```

---

### Task 17: Final verification

- [ ] **Step 1: Full build check**

```bash
npm run build
```
Expected: clean compilation

- [ ] **Step 2: Full test suite**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 3: Docker build**

```bash
docker build -t rental-scout-bot .
```
Expected: successful build

- [ ] **Step 4: Final commit with any remaining fixes**

If any issues were found in steps 1-3, fix them and commit.
