const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevelrole')
    .setDescription('Set a role reward for reaching a level [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(opt =>
      opt.setName('level').setDescription('The level required to get the role').setRequired(true).setMinValue(1).setMaxValue(1000)
    )
    .addRoleOption(opt =>
      opt.setName('role').setDescription('The role to assign at this level').setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [Embed.error('Permission Denied', 'You need Administrator permission.')], ephemeral: true });
    }

    const level = interaction.options.getInteger('level');
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;

    db.prepare(`
      INSERT INTO level_roles (guild_id, level, role_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, level) DO UPDATE SET role_id = ?
    `).run(guildId, level, role.id, role.id);

    await interaction.reply({
      embeds: [Embed.success(
        'Level Role Set',
        `Members who reach **Level ${level}** will now receive ${role}.`,
        [
          { name: 'Level', value: `${level}`, inline: true },
          { name: 'Role', value: `${role}`, inline: true },
        ]
      )],
    });
  },
};
