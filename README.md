# Rental Scout Discord Bot

A personal Discord bot that monitors Austin, TX rental listings, evaluates them using Claude AI, and sends alerts to a Discord channel.

## Sources

- **Realtor.com** via RapidAPI ("Realty in US" API)
- **Craigslist** via Gmail IMAP (parses Craigslist email alerts)

## How It Works

1. Runs an hourly scan (6am–6pm) fetching listings from all sources
2. Deduplicates and stores listings in a local SQLite database
3. Quick-filters by price, bedrooms, bathrooms, and home type
4. Sends candidates to Claude for vibe/preference evaluation (MCM, natural light, character, etc.)
5. Posts results to Discord with score-based tiers:
   - **60+**: Posts with @mention
   - **40–59**: Posts silently
   - **<40**: Logged only

## Slash Commands

| Command | Description |
|---|---|
| `/start` | Initialize preferences |
| `/show-preferences` | View current preferences |
| `/set-budget` | Update budget range |
| `/set-areas` | Update preferred/excluded areas |
| `/set-preferences` | Update home types, must-haves, etc. |
| `/pause-alerts` | Pause notifications |
| `/resume-alerts` | Resume notifications |
| `/test-alert` | Send a test alert |
| `/scan-now` | Trigger an immediate scan |

## Setup

### Prerequisites

- Node.js 20+
- Discord bot token and server
- RapidAPI key with "Realty in US" subscription
- Anthropic API key
- Gmail account with app password (for Craigslist alerts)

### Environment Variables

Create a `.env` file:

```env
ANTHROPIC_API_KEY=
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL=./data/rental-scout.db
ALERT_CHANNEL_ID=
USER_DISCORD_ID=

# RapidAPI
RAPIDAPI_KEY=
RAPIDAPI_SOURCES=realty-us
RAPIDAPI_HOST_REALTY_US=realty-in-us.p.rapidapi.com

# Craigslist (optional)
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

### Craigslist Setup

1. Create a Gmail account and enable 2FA
2. Generate an app password (Google Account > Security > App passwords)
3. Set up a Craigslist saved search for your area with email alerts enabled, sending to the Gmail account
4. Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to `.env`

### Run Locally

```bash
npm install
npm run build
node dist/index.js
```

### Run with Docker

```bash
npm install
npm run build
docker compose up -d
```

The database persists in `./data/` via a volume mount. To migrate to another machine, copy the entire project directory including `./data/rental-scout.db`.
