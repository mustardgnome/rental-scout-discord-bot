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
