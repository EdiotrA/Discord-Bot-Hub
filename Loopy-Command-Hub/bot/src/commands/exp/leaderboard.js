const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ExpUtil = require('../../utils/exp');
const config = require('../../config');

const medals = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 EXP leaderboard for this server'),

  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const entries = ExpUtil.getLeaderboard(guildId, 10);

    if (!entries.length) {
      const Embed = require('../../utils/embed');
      return interaction.editReply({ embeds: [Embed.info('Leaderboard', 'No EXP data yet. Start chatting to earn EXP!')] });
    }

    const lines = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const medal = medals[i] || `**${i + 1}.**`;
      const level = ExpUtil.getLevel(entry.exp);
      let username = `<@${entry.user_id}>`;

      lines.push(`${medal} ${username} — Level **${level}** — **${entry.exp.toLocaleString()}** EXP`);
    }

    const embed = new EmbedBuilder()
      .setColor(config.colors.gold)
      .setTitle('🏆 EXP Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${interaction.guild.name} • Top 10 Members` })
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
