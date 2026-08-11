const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('kick').setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.editReply({ embeds: [Embed.error('Not Found', 'Member not found in server.')] });
    if (!target.kickable) return interaction.editReply({ embeds: [Embed.error('Cannot Kick', 'I cannot kick this member.')] });
    target.user.send({ embeds: [Embed.error('Kicked', `You were kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}`)] }).catch(() => {});
    await target.kick(reason);
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'KICK', interaction.user.id, target.id, reason);
    const logCh = getSetting(interaction.guildId, 'log_channel');
    if (logCh) { const ch = interaction.guild.channels.cache.get(logCh); if (ch) ch.send({ embeds: [Embed.moderation('Kick', target.user, interaction.user, reason)] }); }
    await interaction.editReply({ embeds: [Embed.success('Member Kicked', `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`)] });
  },
};
