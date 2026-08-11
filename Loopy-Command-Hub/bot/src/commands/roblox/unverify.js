const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('unverify').setDescription('Remove Roblox verification')
    .addUserOption(o => o.setName('user').setDescription('User to unverify (admin only)').setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getUser('user');
    if (target && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) return interaction.reply({ embeds: [Embed.error('No Permission', 'Only admins can unverify others.')], ephemeral: true });
    const userId = target?.id || interaction.user.id;
    db.prepare('DELETE FROM verifications WHERE guild_id = ? AND discord_user_id = ?').run(interaction.guildId, userId);
    await interaction.reply({ embeds: [Embed.success('Unverified', `${target ? `<@${userId}>` : 'You have'} been unverified.`)], ephemeral: true });
  },
};
