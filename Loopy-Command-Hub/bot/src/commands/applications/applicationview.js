const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('applicationview').setDescription('View applications')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('type').setDescription('Filter by type').setRequired(false))
    .addStringOption(o => o.setName('status').setDescription('Filter by status').setRequired(false)
      .addChoices({ name: 'Pending', value: 'pending' }, { name: 'Accepted', value: 'accepted' }, { name: 'Denied', value: 'denied' })),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    let query = 'SELECT * FROM applications WHERE guild_id = ?'; const params = [interaction.guildId];
    if (interaction.options.getString('type')) { query += ' AND type = ?'; params.push(interaction.options.getString('type')); }
    if (interaction.options.getString('status')) { query += ' AND status = ?'; params.push(interaction.options.getString('status')); }
    query += ' ORDER BY submitted_at DESC LIMIT 20';
    const apps = db.prepare(query).all(...params);
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('📋 Applications')
      .setDescription(apps.length ? apps.map(a => `**#${a.id}** • ${a.type} • <@${a.user_id}> • **${a.status.toUpperCase()}** • <t:${a.submitted_at}:R>`).join('\n') : 'No applications found.').setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
