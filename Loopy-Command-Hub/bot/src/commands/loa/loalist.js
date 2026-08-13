const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
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
    const statusEmoji = { pending: '🕓', accepted: '✅', denied: '❌' };
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('📅  LOA Requests')
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(rows.length
        ? rows.map(r => `> ${statusEmoji[r.status] || '•'} **#${r.id}** <@${r.user_id}> — **${r.status.toUpperCase()}**\n> <t:${r.start_date}:D> → <t:${r.end_date}:D>`).join(`\n${Embed.divider}\n`)
        : '*No LOA requests found.*')
      .setFooter(Embed.brandFooter('Leave of Absence')).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
