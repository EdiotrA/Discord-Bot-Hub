const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('modlogs').setDescription('View moderation logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Filter by user').setRequired(false))
    .addStringOption(o => o.setName('action').setDescription('Filter by action').setRequired(false)
      .addChoices({ name: 'Warn', value: 'WARN' }, { name: 'Ban', value: 'BAN' }, { name: 'Kick', value: 'KICK' }, { name: 'Mute', value: 'MUTE' }, { name: 'Timeout', value: 'TIMEOUT' }, { name: 'Note', value: 'NOTE' }))
    .addIntegerOption(o => o.setName('limit').setDescription('Number to show (max 25)').setRequired(false).setMinValue(1).setMaxValue(25)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser('user');
    const action = interaction.options.getString('action');
    const limit = interaction.options.getInteger('limit') || 15;
    let query = 'SELECT * FROM mod_logs WHERE guild_id = ?'; const params = [interaction.guildId];
    if (user) { query += ' AND target_id = ?'; params.push(user.id); }
    if (action) { query += ' AND action = ?'; params.push(action); }
    query += ' ORDER BY created_at DESC LIMIT ?'; params.push(limit);
    const logs = db.prepare(query).all(...params);
    const embed = new EmbedBuilder().setColor(config.colors.moderation).setTitle('📋  Moderation Logs')
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setDescription(logs.length
        ? logs.map(l => `> 🔨 **${l.action}** • <t:${l.created_at}:R>\n> <@${l.target_id}> by <@${l.moderator_id}>\n> **Reason:** ${l.reason || '`N/A`'}`).join(`\n${Embed.divider}\n`)
        : '*No logs found.*')
      .setFooter(Embed.brandFooter('Moderation Logs')).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
