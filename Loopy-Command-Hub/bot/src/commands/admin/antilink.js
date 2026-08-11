const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { getSetting, setSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('Prevent non-staff from posting links')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('enable').setDescription('Enable anti-link'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable anti-link'))
    .addSubcommand(s => s.setName('addrole').setDescription('Allow a role to post links')
      .addRoleOption(o => o.setName('role').setDescription('Exempt role').setRequired(true)))
    .addSubcommand(s => s.setName('removerole').setDescription('Remove a role from exempt list')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('listroles').setDescription('List exempt roles')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    const role = interaction.options.getRole('role');
    const getList = () => JSON.parse(getSetting(gid, 'antilink_allowed_roles') || '[]');
    if (sub === 'enable') { setSetting(gid, 'antilink_enabled', true); return interaction.editReply({ embeds: [Embed.success('Anti-Link Enabled', 'Non-exempt users can no longer post links.')] }); }
    if (sub === 'disable') { setSetting(gid, 'antilink_enabled', false); return interaction.editReply({ embeds: [Embed.warning('Anti-Link Disabled', 'Links are now allowed for everyone.')] }); }
    if (sub === 'addrole') {
      const list = getList(); if (!list.includes(role.id)) list.push(role.id); setSetting(gid, 'antilink_allowed_roles', JSON.stringify(list));
      return interaction.editReply({ embeds: [Embed.success('Role Exempted', `${role} can now post links.`)] });
    }
    if (sub === 'removerole') {
      const list = getList().filter(id => id !== role.id); setSetting(gid, 'antilink_allowed_roles', JSON.stringify(list));
      return interaction.editReply({ embeds: [Embed.success('Role Removed', `${role} is no longer exempt.`)] });
    }
    if (sub === 'listroles') {
      const list = getList();
      return interaction.editReply({ embeds: [Embed.info('Exempt Roles', list.length ? list.map(id => `<@&${id}>`).join(', ') : 'None')] });
    }
  },
};
