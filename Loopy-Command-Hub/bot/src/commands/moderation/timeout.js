const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 7d — max 28d)').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user');
    const dur = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.editReply({ embeds: [Embed.error('Not Found', 'Member not found.')] });
    const msVal = ms(dur);
    if (!msVal || msVal > 2419200000) return interaction.editReply({ embeds: [Embed.error('Invalid', 'Max timeout is 28 days. Example: 10m, 1h, 7d')] });
    await target.timeout(msVal, reason);
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'TIMEOUT', interaction.user.id, target.id, reason);
    await interaction.editReply({ embeds: [Embed.success('Timeout Applied', `**${target.user.tag}** timed out for **${dur}**.\n**Reason:** ${reason}`)] });
  },
};
