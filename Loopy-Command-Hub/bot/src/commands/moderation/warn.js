const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const gid = interaction.guildId;
    db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)').run(gid, target.id, interaction.user.id, reason);
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(gid, 'WARN', interaction.user.id, target.id, reason);
    const count = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?').get(gid, target.id).c;
    target.send({ embeds: [Embed.warning('You Were Warned', `You have been warned in **${interaction.guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${count}`)] }).catch(() => {});
    const logCh = getSetting(gid, 'log_channel');
    if (logCh) { const ch = interaction.guild.channels.cache.get(logCh); if (ch) ch.send({ embeds: [Embed.moderation('Warning', target, interaction.user, reason, [{ name: 'Total Warnings', value: String(count), inline: true }])] }); }
    if (count >= 5) {
      const member = interaction.guild.members.cache.get(target.id);
      if (member) member.ban({ reason: 'Exceeded 5 warnings' }).catch(() => {});
      return interaction.editReply({ embeds: [Embed.warning('User Warned & Banned', `${target.tag} has been warned and **auto-banned** for reaching 5 warnings.`)] });
    }
    await interaction.editReply({ embeds: [Embed.success('User Warned', `**${target.tag}** warned.\n**Reason:** ${reason}\n**Total warnings:** ${count}/5`)] });
  },
};
