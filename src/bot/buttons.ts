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

  const updatedRows = interaction.message.components.map((row) => {
    const json = row.toJSON() as any;
    if (json.components) {
      json.components = json.components.map((comp: any) => {
        if (comp.custom_id === interaction.customId) {
          return { ...comp, disabled: true, label: `✓ ${comp.label}` };
        }
        return { ...comp, disabled: true };
      });
    }
    return json;
  });

  await interaction.update({ components: updatedRows });
}
