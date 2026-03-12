import { ChatInputCommandInteraction } from 'discord.js';
import Database from 'better-sqlite3';
import { updatePreferences } from '../../core/preferences.js';
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
