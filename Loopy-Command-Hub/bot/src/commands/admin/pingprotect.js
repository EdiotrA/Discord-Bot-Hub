const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting, setSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pingprotect')
    .setDescription('Configure protection from unauthorized pings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('enable').setDescription('Enable ping protection'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable ping protection'))
    .addSubcommand(s => s.setName('user').setDescription('Protect or unprotect a user')
      .addStringOption(o => o.setName('action').setDescription('Protection action').setRequired(true).addChoices({ name: 'Protect', value: 'add' }, { name: 'Unprotect', value: 'remove' }))
      .addUserOption(o => o.setName('target').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('role').setDescription('Protect or unprotect a role')
      .addStringOption(o => o.setName('action').setDescription('Protection action').setRequired(true).addChoices({ name: 'Protect', value: 'add' }, { name: 'Unprotect', value: 'remove' }))
      .addRoleOption(o => o.setName('target').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('allow').setDescription('Allow a user to bypass protection')
      .addStringOption(o => o.setName('action').setDescription('Bypass action').setRequired(true).addChoices({ name: 'Allow', value: 'add' }, { name: 'Remove', value: 'remove' }))
      .addUserOption(o => o.setName('target').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('status').setDescription('View protected users and roles')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    if (sub === 'enable' || sub === 'disable') {
      const enabled = sub === 'enable';
      setSetting(guildId, 'ping_protection_enabled', enabled);
      return interaction.reply({ embeds: [Embed.success(`Ping Protection ${enabled ? 'Enabled' : 'Disabled'}`, enabled ? 'Unauthorized mentions of protected users and roles will be removed.' : 'Unauthorized mentions are allowed again.')], ephemeral: true });
    }
    if (sub === 'user') {
      const target = interaction.options.getUser('target');
      const add = interaction.options.getString('action') === 'add';
      db.prepare(add ? 'INSERT OR IGNORE INTO ping_protected_users (guild_id, user_id) VALUES (?, ?)' : 'DELETE FROM ping_protected_users WHERE guild_id = ? AND user_id = ?').run(guildId, target.id);
      return interaction.reply({ embeds: [Embed.success('Protected User Updated', `${target} is ${add ? 'now protected' : 'no longer protected'} from unauthorized pings.`)], ephemeral: true });
    }
    if (sub === 'role') {
      const target = interaction.options.getRole('target');
      const add = interaction.options.getString('action') === 'add';
      db.prepare(add ? 'INSERT OR IGNORE INTO ping_protection (guild_id, protected_role_id) VALUES (?, ?)' : 'DELETE FROM ping_protection WHERE guild_id = ? AND protected_role_id = ?').run(guildId, target.id);
      return interaction.reply({ embeds: [Embed.success('Protected Role Updated', `${target} is ${add ? 'now protected' : 'no longer protected'} from unauthorized pings.`)], ephemeral: true });
    }
    if (sub === 'allow') {
      const target = interaction.options.getUser('target');
      const add = interaction.options.getString('action') === 'add';
      db.prepare(add ? 'INSERT OR IGNORE INTO ping_allowed_users (guild_id, user_id) VALUES (?, ?)' : 'DELETE FROM ping_allowed_users WHERE guild_id = ? AND user_id = ?').run(guildId, target.id);
      return interaction.reply({ embeds: [Embed.success('Ping Bypass Updated', `${target} is ${add ? 'allowed' : 'no longer allowed'} to bypass ping protection.`)], ephemeral: true });
    }
    const users = db.prepare('SELECT user_id FROM ping_protected_users WHERE guild_id = ?').all(guildId).map(row => `<@${row.user_id}>`);
    const roles = db.prepare('SELECT protected_role_id FROM ping_protection WHERE guild_id = ?').all(guildId).map(row => `<@&${row.protected_role_id}>`);
    return interaction.reply({ embeds: [Embed.info('Ping Protection Status', `**Status:** ${getSetting(guildId, 'ping_protection_enabled') ? '🟢 Enabled' : '🔴 Disabled'}`)
      .addFields(
        { name: 'Protected Users', value: users.join(', ') || 'None', inline: true },
        { name: 'Protected Roles', value: roles.join(', ') || 'None', inline: true },
      )], ephemeral: true });
  },
};