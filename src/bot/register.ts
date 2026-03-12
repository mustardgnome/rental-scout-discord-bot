import { REST, Routes, SlashCommandBuilder } from 'discord.js';

export function buildCommands(): SlashCommandBuilder[] {
  return [
    new SlashCommandBuilder()
      .setName('start')
      .setDescription('Initialize the bot with default preferences'),

    new SlashCommandBuilder()
      .setName('show-preferences')
      .setDescription('Show your current rental preferences'),

    new SlashCommandBuilder()
      .setName('set-budget')
      .setDescription('Set your budget range')
      .addIntegerOption((o) =>
        o.setName('target').setDescription('Target monthly budget').setRequired(true),
      )
      .addIntegerOption((o) =>
        o.setName('max').setDescription('Max monthly budget').setRequired(true),
      ) as SlashCommandBuilder,

    new SlashCommandBuilder()
      .setName('set-areas')
      .setDescription('Set your preferred and excluded areas')
      .addStringOption((o) =>
        o.setName('preferred').setDescription('Comma-separated preferred areas'),
      )
      .addStringOption((o) =>
        o.setName('excluded').setDescription('Comma-separated excluded areas'),
      ) as SlashCommandBuilder,

    new SlashCommandBuilder()
      .setName('set-preferences')
      .setDescription('Update specific preferences')
      .addIntegerOption((o) => o.setName('bedrooms').setDescription('Minimum bedrooms'))
      .addIntegerOption((o) => o.setName('bathrooms').setDescription('Minimum bathrooms'))
      .addStringOption((o) =>
        o.setName('home-types').setDescription('Comma-separated home types'),
      )
      .addStringOption((o) =>
        o.setName('must-haves').setDescription('Comma-separated must-have features'),
      )
      .addStringOption((o) =>
        o.setName('nice-to-haves').setDescription('Comma-separated nice-to-have features'),
      )
      .addStringOption((o) =>
        o.setName('vibes').setDescription('Comma-separated vibe preferences'),
      )
      .addStringOption((o) =>
        o.setName('zip-codes').setDescription('Comma-separated preferred zip codes (soft preference)'),
      ) as SlashCommandBuilder,

    new SlashCommandBuilder()
      .setName('pause-alerts')
      .setDescription('Pause rental alerts (bot still tracks listings)'),

    new SlashCommandBuilder()
      .setName('resume-alerts')
      .setDescription('Resume rental alerts'),

    new SlashCommandBuilder()
      .setName('test-alert')
      .setDescription('Send a test alert to verify the bot is working'),

    new SlashCommandBuilder()
      .setName('scan-now')
      .setDescription('Run a listing scan immediately'),
  ];
}

export async function registerCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = buildCommands().map((c) => c.toJSON());

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
}
