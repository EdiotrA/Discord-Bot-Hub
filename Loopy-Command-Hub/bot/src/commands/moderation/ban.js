const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false))
    .addStringOption(o => o.setName('duration').setDescription('Temp ban duration (e.g. 7d, 24h)').setRequired(false))
    .addIntegerOption(o => o.setName('deletedays').setDescription('Days of messages to delete (0-7)').setRequired(false).setMinValue(0).setMaxValue(7)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const duration = interaction.options.getString('duration');
    const deletedays = interaction.options.getInteger('deletedays') || 0;
    const member = interaction.guild.members.cache.get(target.id);
    if (member && !member.bannable) return interaction.editReply({ embeds: [Embed.error('Cannot Ban', 'I cannot ban this member.')] });
    target.send({ embeds: [Embed.error('Banned', `You were banned from **${interaction.guild.name}**.\n**Reason:** ${reason}${duration ? `\n**Duration:** ${duration}` : ''}`)] }).catch(() => {});
    await interaction.guild.members.ban(target.id, { reason, deleteMessageDays: deletedays });
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'BAN', interaction.user.id, target.id, reason);
    const logCh = getSetting(interaction.guildId, 'log_channel');
    if (logCh) { const ch = interaction.guild.channels.cache.get(logCh); if (ch) ch.send({ embeds: [Embed.moderation('Ban', target, interaction.user, reason, duration ? [{ name: 'Duration', value: duration, inline: true }] : [])] }); }
    if (duration) { const ms_val = ms(duration); if (ms_val) setTimeout(() => interaction.guild.members.unban(target.id, 'Temp ban expired').catch(() => {}), ms_val); }
    await interaction.editReply({ embeds: [Embed.success('User Banned', `**${target.tag}** has been banned.\n**Reason:** ${reason}${duration ? `\n**Duration:** ${duration}` : ''}`)] });
  },
};
