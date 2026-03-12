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
