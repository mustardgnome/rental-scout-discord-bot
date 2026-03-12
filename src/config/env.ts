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
