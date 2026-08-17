const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const ExpUtil = require('../../utils/exp');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the EXP leaderboard')
    .addStringOption(o => o
      .setName('scope')
      .setDescription('Server or Global ranking')
      .addChoices(
        { name: 'This Server', value: 'server' },
        { name: 'Global',      value: 'global'  },
      )),

  async execute(interaction) {
    await interaction.deferReply();

    const scope  = interaction.options.getString('scope') ?? 'server';
    const global = scope === 'global';

    const entries = global
      ? ExpUtil.getGlobalLeaderboard(10)
      : ExpUtil.getLeaderboard(interaction.guildId, 10);

    if (!entries.length) {
      return interaction.editReply({
        embeds: [Embed.info('EXP Leaderboard', 'No EXP data yet. Start chatting to earn EXP!')],
      });
    }

    const lines = entries.map((entry, i) => {
      const pos    = i < 3 ? ['1.', '2.', '3.'][i] : `${i + 1}.`;
      const level  = ExpUtil.getLevel(entry.exp);
      const server = global && entry.server_count > 1 ? ` · ${entry.server_count} servers` : '';
      return `${pos} <@${entry.user_id}> · Level **${level}** · **${entry.exp.toLocaleString()}** EXP${server}`;
    });

    const title = global ? 'EXP Leaderboard — Global' : 'EXP Leaderboard — This Server';
    const footerExtra = global
      ? 'Global · EXP summed across all servers'
      : `Top members in ${interaction.guild.name}`;

    return interaction.editReply({
      embeds: [Embed.base({
        color:       config.colors.gold,
        title,
        description: lines.join('\n'),
        thumbnail:   global ? null : interaction.guild.iconURL({ dynamic: true }),
        footer:      footerExtra,
      })],
    });
  },
};
