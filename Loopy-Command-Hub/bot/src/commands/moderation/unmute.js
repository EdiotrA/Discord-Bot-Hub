const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('unmute').setDescription('Unmute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user');
    if (!target) return interaction.editReply({ embeds: [Embed.error('Not Found', 'Member not found.')] });
    await target.timeout(null).catch(() => {});
    const muteRole = getSetting(interaction.guildId, 'mute_role');
    if (muteRole) await target.roles.remove(muteRole).catch(() => {});
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'UNMUTE', interaction.user.id, target.id, 'Unmuted');
    await interaction.editReply({ embeds: [Embed.success('Member Unmuted', `**${target.user.tag}** has been unmuted.`)] });
  },
};
