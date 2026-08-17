const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

const STATUS_EMOJI = {
  success: '✅',
  failed: '❌',
  timeout: '⏱️',
  pending: '⏳',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verifylog')
    .setDescription('View recent verification attempts for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o
      .setName('limit')
      .setDescription('Number of entries to show (default 10, max 25)')
      .setMinValue(1)
      .setMaxValue(25)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const limit = interaction.options.getInteger('limit') ?? 10;

    const rows = db.prepare(
      `SELECT * FROM verify_logs WHERE guild_id = ?
       ORDER BY created_at DESC LIMIT ?`,
    ).all(interaction.guildId, limit);

    if (!rows.length) {
      return interaction.editReply({
        embeds: [Embed.info('Verification Logs', 'No verification attempts recorded yet for this server.')],
      });
    }

    const lines = rows.map(r => {
      const emoji = STATUS_EMOJI[r.status] || '❓';
      const time = `<t:${r.created_at}:R>`;
      const roblox = r.roblox_username ? ` — \`${r.roblox_username}\`` : '';
      return `${emoji} <@${r.discord_user_id}>${roblox} ${time}`;
    });

    // Group summary
    const total = rows.length;
    const counts = rows.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
    const summary = Object.entries(counts)
      .map(([s, n]) => `${STATUS_EMOJI[s] || '❓'} **${s}:** ${n}`)
      .join(' · ');

    return interaction.editReply({
      embeds: [
        Embed.base({
          color: require('../../config').colors.primary,
          emoji: '📋',
          title: `Verification Log — Last ${total}`,
          description: lines.join('\n'),
          fields: [{ name: 'Summary', value: summary, inline: false }],
          footer: 'Verification Logs',
        }),
      ],
    });
  },
};
