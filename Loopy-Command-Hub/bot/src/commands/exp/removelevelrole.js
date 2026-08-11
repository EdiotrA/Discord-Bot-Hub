const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removelevelrole')
    .setDescription('Remove a level role reward [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt =>
      opt.setName('level').setDescription('The level whose role reward to remove').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [Embed.error('Permission Denied', 'You need Administrator permission.')], ephemeral: true });
    }

    const level = interaction.options.getInteger('level');
    const guildId = interaction.guildId;

    const existing = db.prepare('SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?').get(guildId, level);
    if (!existing) {
      return interaction.reply({ embeds: [Embed.error('Not Found', `No level role reward is set for Level ${level}.`)], ephemeral: true });
    }

    db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?').run(guildId, level);

    await interaction.reply({
      embeds: [Embed.success('Level Role Removed', `The role reward for **Level ${level}** has been removed.`)],
    });
  },
};
