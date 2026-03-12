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
