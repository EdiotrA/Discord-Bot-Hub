const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('loalist').setDescription('View LOA requests')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('status').setDescription('Filter').setRequired(false)
      .addChoices({ name: 'All', value: 'all' }, { name: 'Pending', value: 'pending' }, { name: 'Accepted', value: 'accepted' }, { name: 'Denied', value: 'denied' })),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const status = interaction.options.getString('status') || 'all';
    let rows = db.prepare('SELECT * FROM loa_requests WHERE guild_id = ?' + (status !== 'all' ? ' AND status = ?' : '') + ' ORDER BY created_at DESC LIMIT 20').all(...(status !== 'all' ? [interaction.guildId, status] : [interaction.guildId]));
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('📅 LOA Requests')
      .setDescription(rows.length ? rows.map(r => `**#${r.id}** <@${r.user_id}> — **${r.status.toUpperCase()}**\n<t:${r.start_date}:D> → <t:${r.end_date}:D>`).join('\n\n') : 'No LOA requests found.').setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
