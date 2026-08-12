const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { getSetting, setSetting } = require('../../database');

function getList(guildId, key) {
  try { return JSON.parse(getSetting(guildId, key) || '[]'); } catch { return []; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('badword')
    .setDescription('Configure bad-word protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('enable').setDescription('Enable bad-word filtering'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable bad-word filtering'))
    .addSubcommand(s => s.setName('add').setDescription('Add a word or phrase')
      .addStringOption(o => o.setName('word').setDescription('Word or phrase to filter').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a filtered word or phrase')
      .addStringOption(o => o.setName('word').setDescription('Word or phrase to remove').setRequired(true).setMaxLength(100)))
    .addSubcommand(s => s.setName('addrole').setDescription('Allow a role to bypass the filter')
      .addRoleOption(o => o.setName('role').setDescription('Exempt role').setRequired(true)))
    .addSubcommand(s => s.setName('removerole').setDescription('Remove a role exemption')
      .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('View filter settings')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    if (sub === 'enable' || sub === 'disable') {
      const enabled = sub === 'enable';
      setSetting(guildId, 'badword_enabled', enabled);
      return interaction.reply({ embeds: [Embed.success(`Bad-Word Filter ${enabled ? 'Enabled' : 'Disabled'}`, enabled ? 'Messages containing configured words will be removed for non-exempt members.' : 'Bad-word filtering is now disabled.')], ephemeral: true });
    }
    if (sub === 'add' || sub === 'remove') {
      const word = interaction.options.getString('word').trim().toLowerCase();
      const list = getList(guildId, 'badword_words');
      const next = sub === 'add' ? [...new Set([...list, word])] : list.filter(item => item !== word);
      setSetting(guildId, 'badword_words', JSON.stringify(next));
      return interaction.reply({ embeds: [Embed.success(sub === 'add' ? 'Filtered Word Added' : 'Filtered Word Removed', `\`${word}\` is ${sub === 'add' ? 'now filtered' : 'no longer filtered'}.`)], ephemeral: true });
    }
    if (sub === 'addrole' || sub === 'removerole') {
      const role = interaction.options.getRole('role');
      const list = getList(guildId, 'badword_allowed_roles');
      const next = sub === 'addrole' ? [...new Set([...list, role.id])] : list.filter(id => id !== role.id);
      setSetting(guildId, 'badword_allowed_roles', JSON.stringify(next));
      return interaction.reply({ embeds: [Embed.success('Bad-Word Role Updated', `${role} is ${sub === 'addrole' ? 'exempt from' : 'no longer exempt from'} the filter.`)], ephemeral: true });
    }
    const words = getList(guildId, 'badword_words');
    const roles = getList(guildId, 'badword_allowed_roles');
    return interaction.reply({ embeds: [Embed.info('Bad-Word Protection', `**Status:** ${getSetting(guildId, 'badword_enabled') ? '🟢 Enabled' : '🔴 Disabled'}\n**Words:** ${words.length ? words.map(word => `\`${word}\``).join(', ') : 'None configured'}\n**Exempt roles:** ${roles.length ? roles.map(id => `<@&${id}>`).join(', ') : 'None'}`)], ephemeral: true });
  },
};