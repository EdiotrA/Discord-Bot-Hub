const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const {
  grantAll, revokeAll, getGlobalPermissions, setCategoryPermission, CATEGORY_NAMES,
  addPermission, removePermission, setPermissions, getPermissions, getRolePermissions,
} = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('permission')
    .setDescription('Manage Loopy command access for users, roles, and categories')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('grantall').setDescription('Give a user or role access to every Loopy command')
      .addUserOption(o => o.setName('user').setDescription('User to grant').setRequired(false))
      .addRoleOption(o => o.setName('role').setDescription('Role to grant').setRequired(false)))
    .addSubcommand(s => s.setName('revokeall').setDescription('Remove a user or role from every-command access')
      .addUserOption(o => o.setName('user').setDescription('User to revoke').setRequired(false))
      .addRoleOption(o => o.setName('role').setDescription('Role to revoke').setRequired(false)))
    .addSubcommand(s => s.setName('listall').setDescription('List users and roles with access to every command'))
    .addSubcommand(s => s.setName('category').setDescription('Set the default access for a command category')
      .addStringOption(o => o.setName('name').setDescription('Category name').setRequired(true).addChoices(...CATEGORY_NAMES.map(name => ({ name, value: name }))))
      .addStringOption(o => o.setName('mode').setDescription('Who can use the category by default').setRequired(true)
        .addChoices({ name: 'Everyone', value: 'everyone' }, { name: 'Roles only', value: 'roles' }, { name: 'Default', value: 'default' }))
      .addRoleOption(o => o.setName('role1').setDescription('Role allowed when mode is Roles only').setRequired(false))
      .addRoleOption(o => o.setName('role2').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role3').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role4').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role5').setDescription('Additional role').setRequired(false)))
    .addSubcommand(s => s.setName('grant').setDescription('Add roles to a command permission list')
      .addStringOption(o => o.setName('command').setDescription('Command to configure').setRequired(true).setAutocomplete(true))
      .addRoleOption(o => o.setName('role1').setDescription('Allowed role').setRequired(true))
      .addRoleOption(o => o.setName('role2').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role3').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role4').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role5').setDescription('Additional role').setRequired(false)))
    .addSubcommand(s => s.setName('revoke').setDescription('Remove a role from a command permission list')
      .addStringOption(o => o.setName('command').setDescription('Command to configure').setRequired(true).setAutocomplete(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s.setName('set').setDescription('Replace a command permission list')
      .addStringOption(o => o.setName('command').setDescription('Command to configure').setRequired(true).setAutocomplete(true))
      .addRoleOption(o => o.setName('role1').setDescription('Allowed role').setRequired(false))
      .addRoleOption(o => o.setName('role2').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role3').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role4').setDescription('Additional role').setRequired(false))
      .addRoleOption(o => o.setName('role5').setDescription('Additional role').setRequired(false)))
    .addSubcommand(s => s.setName('view').setDescription('View command or role permission lists')
      .addStringOption(o => o.setName('command').setDescription('Command to view').setRequired(false).setAutocomplete(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to view').setRequired(false))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');
    if (sub === 'grantall' || sub === 'revokeall') {
      if (!user && !role) return interaction.reply({ embeds: [Embed.error('Choose a Target', 'Provide either a user or a role.')], ephemeral: true });
      if (user && role) return interaction.reply({ embeds: [Embed.error('Choose One Target', 'Provide a user or a role, not both.')], ephemeral: true });
      if (sub === 'grantall') grantAll(interaction.guildId, { userId: user?.id, roleId: role?.id }, interaction.user.id);
      else revokeAll(interaction.guildId, { userId: user?.id, roleId: role?.id });
      return interaction.reply({ embeds: [Embed.success(sub === 'grantall' ? 'Global Access Granted' : 'Global Access Revoked', `${user || role} ${sub === 'grantall' ? 'can now use every Loopy command.' : 'no longer has global Loopy command access.'}`)], ephemeral: true });
    }
    if (sub === 'listall') {
      const rows = getGlobalPermissions(interaction.guildId);
      const value = rows.length ? rows.map(row => row.user_id ? `<@${row.user_id}>` : `<@&${row.role_id}>`).join('\n') : 'No global grants configured.';
      return interaction.reply({ embeds: [Embed.info('Global Command Access', value)], ephemeral: true });
    }
    if (['grant', 'revoke', 'set', 'view'].includes(sub)) {
      const command = interaction.options.getString('command')?.toLowerCase().replace(/^\//, '');
      const targetRole = interaction.options.getRole('role');
      if (sub === 'grant') {
        const roles = ['role1', 'role2', 'role3', 'role4', 'role5'].map(key => interaction.options.getRole(key)).filter(Boolean);
        roles.forEach(target => addPermission(interaction.guildId, command, target.id));
        return interaction.reply({ embeds: [Embed.success('Command Permissions Updated', `${roles.map(target => target.toString()).join(', ')} can now use \`/${command}\`.`)], ephemeral: true });
      }
      if (sub === 'revoke') {
        removePermission(interaction.guildId, command, targetRole.id);
        return interaction.reply({ embeds: [Embed.success('Command Permission Removed', `${targetRole} can no longer use \`/${command}\`.`)], ephemeral: true });
      }
      if (sub === 'set') {
        const roles = ['role1', 'role2', 'role3', 'role4', 'role5'].map(key => interaction.options.getRole(key)).filter(Boolean);
        setPermissions(interaction.guildId, command, roles.map(target => target.id));
        return interaction.reply({ embeds: [Embed.success('Command Permissions Replaced', `\`/${command}\` now has ${roles.length ? roles.map(target => target.toString()).join(', ') : 'no custom roles'}.`)], ephemeral: true });
      }
      if (command) {
        const roles = getPermissions(interaction.guildId, command);
        return interaction.reply({ embeds: [Embed.info(`Permissions for /${command}`, roles.length ? roles.map(id => `<@&${id}>`).join(', ') : 'No custom command roles set.')], ephemeral: true });
      }
      if (targetRole) {
        const commands = getRolePermissions(interaction.guildId, targetRole.id);
        return interaction.reply({ embeds: [Embed.info(`Commands for ${targetRole.name}`, commands.length ? commands.map(name => `\`/${name}\``).join(', ') : 'No commands assigned.')], ephemeral: true });
      }
      return interaction.reply({ embeds: [Embed.info('Command Permissions', 'Use the command autocomplete, or provide a role, to view permissions.')], ephemeral: true });
    }
    const category = interaction.options.getString('name');
    const mode = interaction.options.getString('mode');
    const roles = ['role1', 'role2', 'role3', 'role4', 'role5'].map(key => interaction.options.getRole(key)).filter(Boolean);
    if (mode === 'roles' && !roles.length) return interaction.reply({ embeds: [Embed.error('Roles Required', 'Add at least one role when using Roles only.')], ephemeral: true });
    setCategoryPermission(interaction.guildId, category, mode, roles.map(r => r.id));
    return interaction.reply({ embeds: [Embed.success('Category Permission Updated', `**${category}** now defaults to **${mode}**${roles.length ? ` for ${roles.join(', ')}` : ''}.`)], ephemeral: true });
  },
};