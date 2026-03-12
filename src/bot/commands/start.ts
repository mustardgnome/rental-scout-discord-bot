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
