const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const ExpUtil = require('../../utils/exp');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('View all level role rewards for this server'),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const levelRoles = ExpUtil.getLevelRoles(guildId);

    if (!levelRoles.length) {
      return interaction.reply({ embeds: [Embed.info('Level Roles', 'No level role rewards have been configured yet.\nUse `/setlevelrole` to add one.')] });
    }

    const lines = levelRoles.map(lr => `**Level ${lr.level}** → <@&${lr.role_id}>`);

    const embed = new EmbedBuilder()
      .setColor(config.colors.gold)
      .setTitle('🎖️ Level Role Rewards')
      .setDescription(lines.join('\n'))
      .setFooter({ text: `${levelRoles.length} reward(s) configured` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
