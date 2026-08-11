const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('userid').setDescription('User ID to unban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.options.getString('userid');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    try {
      await interaction.guild.members.unban(userId, reason);
      db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'UNBAN', interaction.user.id, userId, reason);
      const logCh = getSetting(interaction.guildId, 'log_channel');
      if (logCh) { const ch = interaction.guild.channels.cache.get(logCh); if (ch) ch.send({ embeds: [Embed.success('User Unbanned', `User ID: \`${userId}\`\n**By:** ${interaction.user.tag}\n**Reason:** ${reason}`)] }); }
      await interaction.editReply({ embeds: [Embed.success('User Unbanned', `\`${userId}\` has been unbanned.`)] });
    } catch { await interaction.editReply({ embeds: [Embed.error('Error', 'Could not unban. Make sure the user ID is correct and they are banned.')] }); }
  },
};
