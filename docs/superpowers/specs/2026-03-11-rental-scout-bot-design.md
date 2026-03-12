# Rental Scout Bot — Design Spec

## Overview

A personal Discord bot that monitors Austin, TX rental listings hourly, evaluates them against user preferences using Claude, and sends alerts to a dedicated Discord channel. Single user, single market, simple and practical.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | SQLite via `better-sqlite3` | Single user, zero setup, file-based persistence |
| Architecture | Single-process monolith | One container, one process. Docker restart handles crashes. Code is modular enough to split later if needed. |
| Hosting | Docker container on always-on machine | `docker-compose.yml` with restart policy and volume mount for DB |
| Listing source | RapidAPI (multiple real-estate APIs) | Paid tier. Pluggable adapter layer, start with RapidAPI providers, add more later. |
| Discord alerts | Dedicated channel with @mention pings | No DMs. One channel. |
| Claude evaluation | Batch with ~20 listing cap per call | Keeps costs low, avoids context degradation on large batches |
| Claude model | claude-sonnet-4-6 | Fast, cheap, more than capable for preference matching |
| Feedback learning | Context injection into Claude prompt | Include recent feedback history in evaluation prompt. No programmatic scoring adjustments. |

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Database:** SQLite via `better-sqlite3`
- **Discord:** `discord.js` v14
- **Claude:** `@anthropic-ai/sdk`
- **Scheduling:** `node-cron`
- **HTTP:** `axios`
- **Config:** `dotenv`
- **Container:** Docker + docker-compose

## Project Structure

```
rental-scout-bot/
  src/
    bot/
      commands/        # slash command handlers
      alerts.ts        # format & send Discord alerts
      buttons.ts       # feedback button handler
      register.ts      # register slash commands with Discord
    providers/
      types.ts         # provider interface
      rapidapi.ts      # RapidAPI adapter(s)
    core/
      preferences.ts   # load/save preferences
      listings.ts      # listing normalization & comparison
      evaluate.ts      # Claude evaluation
      notifications.ts # notification rules & cooldowns
    jobs/
      hourlyCheck.ts   # the main hourly flow
    db/
      schema.ts        # SQLite table definitions
      storage.ts       # DB read/write functions
    config/
      env.ts           # env var loading & validation
    index.ts           # entry point: start bot + schedule job
  .env.example
  Dockerfile
  docker-compose.yml
  package.json
  tsconfig.json
```

## Database Schema

### preferences

Single row storing the user's preference profile as JSON.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Always 1 |
| data | TEXT | JSON blob of preference object (includes `alerts_paused` boolean) |
| updated_at | TEXT | ISO timestamp |

### listings

Every listing the bot has seen.

| Column | Type | Notes |
|---|---|---|
| id | TEXT PRIMARY KEY | Composite key: `"source-externalId"` (e.g. `"rapidapi-12345"`) |
| source | TEXT | Provider name |
| raw_data | TEXT | Full normalized listing JSON |
| price | INTEGER | Denormalized for quick queries |
| status | TEXT | `"active"`, `"delisted"` |
| hidden | INTEGER | 0 or 1. Set to 1 when user clicks "Hide". |
| evaluation_status | TEXT | `"pending"`, `"evaluated"`, `"failed"`. For retry after Claude outages. |
| match_score | INTEGER | Nullable. Last Claude score (0-100). |
| match_reason | TEXT | Nullable. Last Claude `why_match` text. |
| mismatch_reason | TEXT | Nullable. Last Claude `why_not` text. |
| first_seen_at | TEXT | ISO timestamp |
| last_seen_at | TEXT | ISO timestamp |
| last_notified_at | TEXT | Nullable. For cooldown logic. |
| missed_runs | INTEGER | Default 0. Incremented when listing not returned by provider. Used for delisting detection. |

**Indexes:**

- `listings(status)` — filter active listings
- `listings(last_notified_at)` — cooldown checks
- `listings(evaluation_status)` — find un-evaluated listings
- `listings(hidden)` — quick filter exclusion

### listing_history

Snapshots when a listing changes.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| listing_id | TEXT | FK to listings |
| change_type | TEXT | `"new"`, `"price_drop"`, `"back_on_market"`, `"status_change"`, `"updated"` |
| previous_price | INTEGER | Nullable |
| new_price | INTEGER | Nullable |
| changed_fields | TEXT | JSON object of field name → {old, new} for "updated" type. Nullable. |
| detected_at | TEXT | ISO timestamp |

Note: `listing_history` stores changed fields rather than full snapshots. For `price_drop`, use `previous_price`/`new_price`. For `updated`, use `changed_fields` JSON. This avoids large blob accumulation.

### feedback

Button click events from Discord alerts.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| listing_id | TEXT | FK to listings |
| feedback_type | TEXT | `"love_it"`, `"hide"`, `"too_expensive"`, `"wrong_area"`, `"wrong_vibe"`, `"more_like_this"` |
| created_at | TEXT | ISO timestamp |

**Indexes:**

- `feedback(listing_id)` — for feedback lookups

## TypeScript Interfaces

### UserPreferences

```typescript
interface UserPreferences {
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
```

Default values:

```json
{
  "market": "Austin, TX",
  "target_budget": 2200,
  "max_budget": 2400,
  "preferred_areas": ["Zilker", "Bouldin", "South Lamar", "South Austin"],
  "excluded_areas": [],
  "min_bedrooms": 2,
  "min_bathrooms": 1,
  "preferred_home_types": ["house", "duplex", "townhome", "condo"],
  "must_haves": ["laundry"],
  "nice_to_haves": ["yard", "wood floors", "good natural light"],
  "vibe_preferences": [
    "character over sterile luxury",
    "quieter residential feel",
    "not a giant generic complex"
  ],
  "alerts_paused": false
}
```

### NormalizedListing

```typescript
interface NormalizedListing {
  listing_id: string;       // Raw external ID from the source API
  source: string;           // Provider name (e.g. "rapidapi-realty-us")
  address: string;
  neighborhood: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  home_type: string;
  features: string[];
  description: string;
  image_url: string | null; // Primary photo URL for Discord embed thumbnail
  url: string;              // Link to listing
  status: string;
}
```

The DB composite key is constructed as `"${source}-${listing_id}"`. The `listing_id` field on this interface is the raw external ID only. All internal references (DB lookups, Claude responses, feedback) use the composite key.

### ClaudeEvaluationResult

```typescript
interface ClaudeEvaluationResult {
  listing_id: string;       // Composite key (same as DB id)
  match_score: number;      // 0-100
  notify: boolean;
  why_match: string;
  why_not: string;
  alert_type: "new_match" | "price_drop" | "back_on_market" | "improved_listing" | "ignore";
}
```

The `alert_type` is determined by the hourly worker (which knows the change type) and passed to Claude as context. Claude confirms or overrides it. Valid values:

- `new_match` — new listing that matches preferences
- `price_drop` — price decreased meaningfully
- `back_on_market` — was delisted, now active again
- `improved_listing` — updated with better details
- `ignore` — Claude says don't notify

## Provider Layer

### Interface

```typescript
interface ListingProvider {
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

Optional filter params allow server-side filtering where APIs support it, reducing wasted quota. Providers that don't support server-side filters ignore these params and the hourly worker's quick filter catches them client-side.

### RapidAPI Strategy

The `rapidapi.ts` adapter supports multiple RapidAPI real-estate APIs behind one provider:

- **Realty in US** — houses, duplexes, condos for rent
- **Zillow-type APIs** — broader apartment/rental coverage
- **Realtor.com APIs** — MLS-like data

Each sub-source normalizes into the same `NormalizedListing` shape. Active sources are configured via the `RAPIDAPI_SOURCES` env var (see Environment Variables).

### Deduplication

Multiple APIs may return the same property. Deduplicate using a simple heuristic: normalize the street number + first word of street name to lowercase, and compare. This avoids the complexity of full address parsing while catching obvious duplicates ("123 Example St" and "123 Example Street"). If the DB already has the listing from a different source, keep the existing record and update `last_seen_at`.

### Rate Limiting

Each provider tracks its own call budget per hourly run based on the RapidAPI tier limits.

## Hourly Worker Flow

`hourlyCheck.ts` runs via `node-cron` on the hour. A simple mutex flag prevents concurrent runs — if the previous run is still going, skip the current tick and log a warning.

1. **Check mutex** — if already running, skip and log
2. **Load preferences** from DB. If `alerts_paused`, still run steps 3-5 (track listings) but skip steps 6-9 (no evaluation or alerts).
3. **Fetch listings** from all active providers. Track which providers succeeded. If a provider fails, log the error and continue with results from other providers. Never abort the entire run for one provider failure.
4. **Deduplicate** by normalized address
5. **Upsert and classify** — for each fetched listing, compare against DB state and upsert in one pass:
   - **New** (not in DB): insert with `evaluation_status: "pending"`, write `listing_history` row with `change_type: "new"`
   - **Price decreased**: update record, write `listing_history` row with `change_type: "price_drop"` (with `previous_price`/`new_price`), set `evaluation_status: "pending"`
   - **Was delisted, now active**: update `status: "active"`, write `listing_history` row with `change_type: "back_on_market"`, set `evaluation_status: "pending"`
   - **Meaningful field changes**: update record, write `listing_history` row with `change_type: "updated"` (with `changed_fields` JSON), set `evaluation_status: "pending"`
   - **No meaningful change**: update `last_seen_at` only
   - For all fetched listings: reset `missed_runs` to 0, update `last_seen_at`

   **"Meaningful field changes" defined:** a change is meaningful if any of these fields differ: `price`, `bedrooms`, `bathrooms`, `sqft`, `home_type`, `status`, or if `features` array gains new items. Changes to `description` text alone or `last_seen_at` are not meaningful.

6. **Detect delisted listings** — for any active listing in DB whose **source provider succeeded this run** but was NOT in the fetched results, increment `missed_runs`. If `missed_runs >= 3`, set `status: "delisted"`. Important: only increment for listings from providers that actually returned results — a provider outage should not cause false delistings.
7. **Quick filter** — query DB for listings with `evaluation_status IN ("pending", "failed")` and discard obvious mismatches before Claude:
   - Price above `max_budget`
   - Bedrooms below `min_bedrooms`
   - Bathrooms below `min_bathrooms`
   - `home_type` not in `preferred_home_types` (cheap pre-filter, saves Claude calls)
   - Listing neighborhood matches an `excluded_area` (case-insensitive substring match)
   - `hidden = 1` on the listing
   - Listings that fail the quick filter are set to `evaluation_status: "evaluated"` with `match_score: 0` (they're definitively bad fits, no need to ask Claude or retry)
8. **Batch to Claude** — up to 20 remaining candidate listings per call with preferences and recent feedback. Multiple calls if needed. Include the `change_type` for each listing so Claude knows context.
9. **Process results** — for ALL evaluated listings (both `notify: true` and `notify: false`):
    - Store `match_score`, `match_reason`, `mismatch_reason` on the listing
    - Set `evaluation_status = "evaluated"`
    - For `notify: true` only:
      - Check cooldown (skip if `last_notified_at` < 24h ago, unless `price_drop` or `back_on_market`)
      - Send Discord alert (with throttling: max 5 messages per 5 seconds to respect Discord rate limits)
      - Update `last_notified_at` only after successful send
10. **Mark failed evaluations** — if a Claude call fails (malformed JSON, API error), set `evaluation_status = "failed"` on those listings so they are retried next run

## Claude Evaluation

### System Prompt

Stored as a constant in `evaluate.ts`:

```
You are helping power a personal rental-finder bot for one user in Austin, Texas.

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

Return JSON only. No markdown, no explanation outside the JSON.
```

### User Prompt Template

```
Evaluate these Austin rental listings.

User preferences:
{{PREFERENCES_JSON}}

Recent feedback patterns (last 30 days):
{{FEEDBACK_SUMMARY}}

Listings to evaluate:
{{LISTINGS_JSON}}

Previous state for changed listings:
{{PREVIOUS_LISTINGS_JSON}}

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
}
```

### Template Variable Definitions

**`{{FEEDBACK_SUMMARY}}`** — a simple aggregated summary built by `evaluate.ts` from the last 30 days of feedback. This is NOT a Claude call — it's a hand-coded group-by function that:

1. Queries feedback rows from last 30 days, joined with listing data (neighborhood, price, home_type)
2. Groups by `feedback_type`
3. For each group, generates a template string with count and context

Template patterns:
- `hide` → `"User has hidden {count} listing(s) in {neighborhoods}"`
- `too_expensive` → `"User marked {count} listing(s) as too expensive (prices: {prices})"`
- `wrong_area` → `"User flagged {count} listing(s) as wrong area in {neighborhoods}"`
- `wrong_vibe` → `"User flagged {count} listing(s) as wrong vibe ({home_types})"`
- `love_it` → `"User loved {count} listing(s): {brief descriptions}"`
- `more_like_this` → `"User wants more like {count} listing(s): {brief descriptions}"`

Output is a bullet list of these summaries. Example:

```
- User has hidden 3 listings in East Austin
- User marked 2 listings as too expensive (prices: $2,350, $2,500)
- User loved a duplex in Zilker
- User wants more like a house in Bouldin Creek
```

If no feedback exists yet, this field is: `"No feedback recorded yet."`

**`{{PREVIOUS_LISTINGS_JSON}}`** — included only for listings with change_type `price_drop`, `back_on_market`, or `updated`. Contains the previous price and changed fields from `listing_history`. For `new` listings, this field is omitted or empty. Example:

```json
[
  {
    "listing_id": "rapidapi-realty-us-12345",
    "previous_price": 2400,
    "current_price": 2200,
    "change_type": "price_drop"
  }
]
```

**Token budget:** Listing descriptions are truncated to 300 characters each before inclusion in the prompt. The feedback summary is capped at 500 characters. This keeps each batch well within reasonable token limits.

### Error Handling

- Malformed JSON from Claude → log, set `evaluation_status = "failed"` on those listings, continue
- Claude API 429/5xx → log, set `evaluation_status = "failed"`, continue. Listings retry next run.
- Claude's `notify` decision is trusted. The `match_score` is informational for the user display only.

## Discord Bot

### Access Control

All slash command handlers check `interaction.user.id === env.USER_DISCORD_ID` before executing. If someone else in the server tries a command, respond with an ephemeral "This bot is configured for a specific user."

### Slash Commands

| Command | Description |
|---|---|
| `/start` | Initial setup, saves default preferences, confirms bot is running |
| `/set-preferences` | Accepts individual options: `budget-target`, `budget-max`, `areas`, `excluded-areas`, `bedrooms`, `bathrooms`, `home-types`, `must-haves`, `nice-to-haves`, `vibes`. Each is optional — only updates provided fields. |
| `/show-preferences` | Displays current preferences as a formatted embed |
| `/set-budget` | Quick shortcut: `/set-budget target:2200 max:2400` |
| `/set-areas` | Quick shortcut: `/set-areas preferred:Zilker,Bouldin excluded:` |
| `/pause-alerts` | Sets `alerts_paused: true` in preferences. Hourly job still tracks listings but won't send alerts. |
| `/resume-alerts` | Sets `alerts_paused: false` in preferences |
| `/test-alert` | Sends a fake alert to verify formatting and pings |

Note: `/set-preferences` uses slash command options rather than a modal with raw JSON editing. This avoids the poor UX of editing JSON in a Discord text box. Each option accepts a comma-separated string where applicable (e.g., `areas:Zilker,Bouldin,South Lamar`).

### Alert Format

Discord embed per listing:

```
New Match — Duplex in Zilker

$2,295/mo  |  2bd/1ba  |  950 sqft
123 Example St, Zilker
Duplex

Why it matches:
Good South Austin area fit, duplex format, more character
than a typical generic apartment.

Heads up:
Slightly above target budget, kitchen looks dated.

Score: 78/100

[View Listing]
```

Each alert @mentions the user via `USER_DISCORD_ID`. If the listing has an `image_url`, it's set as the embed thumbnail.

### Alert Type Variants

- **New Match** — default for new listings
- **Price Drop** — includes old → new price (e.g. "~~$2,400~~ → $2,200/mo")
- **Back on Market** — notes it was previously delisted
- **Listing Updated** — notes which fields changed

### Feedback Buttons

Two ActionRows (Discord limit is 5 buttons per row):

- **Row 1:** Love it, Hide, Too expensive, Wrong area, Wrong vibe
- **Row 2:** More like this

On click:
- Write row to `feedback` table
- If "Hide", also set `listings.hidden = 1` on the listing record
- Disable the clicked button and add a checkmark to show selection
- **Hidden listings and price drops:** If a hidden listing later gets a price drop, the listing remains hidden. The user explicitly dismissed it. They can un-hide it via a future `/manage-hidden` command if desired (not in v1 scope).

## Notification Rules

**Notify when:**
- New listing is a decent match (Claude says `notify: true`)
- Price drops enough to matter
- Listing comes back on market
- Listing gains details that make it more appealing

**Don't notify when:**
- Clearly a bad fit (filtered before Claude, or Claude says `notify: false`)
- Change is trivial (not a "meaningful change" per definition above)
- Already alerted < 24h ago (unless `price_drop` or `back_on_market`)
- Listing is hidden
- Alerts are paused

## Docker & Deployment

### Dockerfile

Multi-stage build:
1. `node:20-alpine` — install deps, compile TypeScript
2. `node:20-alpine` — copy compiled JS + node_modules, run `node dist/index.js`

### docker-compose.yml

```yaml
services:
  rental-scout:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - ./data:/app/data
```

SQLite DB lives at `/app/data/rental-scout.db`. Volume mount persists it across container rebuilds.

### Startup Sequence (index.ts)

1. Load and validate env vars
2. Initialize SQLite (create tables if not exist)
3. Register Discord slash commands (non-fatal if this fails — stale commands still work)
4. Start Discord bot (login)
5. Schedule hourly cron job
6. Log ready

### Graceful Shutdown

Listen for SIGTERM/SIGINT. Close Discord client and DB connection cleanly.

## Environment Variables

```
ANTHROPIC_API_KEY=       # Claude API key
DISCORD_BOT_TOKEN=       # Discord bot token
DISCORD_CLIENT_ID=       # Discord application ID
DISCORD_GUILD_ID=        # For guild command registration during dev
DATABASE_URL=            # Path to SQLite file (default: ./data/rental-scout.db)
ALERT_CHANNEL_ID=        # Discord channel for alerts
USER_DISCORD_ID=         # Your Discord user ID (for pings and access control)

# RapidAPI configuration
RAPIDAPI_KEY=            # Your RapidAPI key
RAPIDAPI_SOURCES=        # Comma-separated list of active sub-sources, e.g. "realty-us,zillow,realtor"

# Per-source host overrides (one per active sub-source)
RAPIDAPI_HOST_REALTY_US=realty-in-us.p.rapidapi.com
RAPIDAPI_HOST_ZILLOW=zillow-working-api.p.rapidapi.com
RAPIDAPI_HOST_REALTOR=realtor-com4.p.rapidapi.com
```

The `RAPIDAPI_SOURCES` env var controls which sub-sources are active. Each sub-source has its own `RAPIDAPI_HOST_*` var. This allows enabling/disabling individual sources without code changes.

## Failure Handling Summary

| Failure | Behavior |
|---|---|
| One RapidAPI provider fails | Log error, continue with other providers |
| All providers return zero results | Log warning, skip evaluation, don't alert |
| Claude API error (429, 5xx) | Log, mark listings as `evaluation_status: "failed"`, retry next run |
| Claude returns bad JSON | Same as API error — log, mark failed, retry |
| Discord rate limit | Throttle outbound messages (max 5 per 5 seconds) |
| Discord send failure | Log error, do NOT update `last_notified_at` (will retry next run) |
| Container restart | Docker `restart: unless-stopped`. SQLite on volume mount survives. `alerts_paused` persisted in DB. |
| Concurrent hourly runs | Mutex flag prevents overlap. Second tick skipped with log warning. |
