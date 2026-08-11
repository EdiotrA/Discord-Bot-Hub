const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('role').setDescription('Add or remove a role from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('Add or remove').setRequired(true).addChoices({ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' })),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');
    const action = interaction.options.getString('action');
    if (!target) return interaction.editReply({ embeds: [Embed.error('Not Found', 'Member not found.')] });
    if (action === 'add') await target.roles.add(role);
    else await target.roles.remove(role);
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, `ROLE_${action.toUpperCase()}`, interaction.user.id, target.id, `${action} ${role.name}`);
    await interaction.editReply({ embeds: [Embed.success('Role Updated', `${action === 'add' ? 'Added' : 'Removed'} ${role} ${action === 'add' ? 'to' : 'from'} ${target}`)] });
  },
};
