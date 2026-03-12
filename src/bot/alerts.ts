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
  new_match: 0x22c55e,
  price_drop: 0x3b82f6,
  back_on_market: 0xf59e0b,
  improved_listing: 0x8b5cf6,
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
