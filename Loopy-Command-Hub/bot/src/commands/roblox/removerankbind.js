const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('removerankbind').setDescription('Remove a rank bind')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('rankid').setDescription('Roblox rank ID').setRequired(true))
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (default: server group)').setRequired(false)),
  async execute(interaction) {
    const groupId = interaction.options.getString('groupid') || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.reply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup`.')], ephemeral: true });
    db.prepare('DELETE FROM rankbinds WHERE guild_id = ? AND roblox_group_id = ? AND roblox_rank_id = ?').run(interaction.guildId, groupId, interaction.options.getInteger('rankid'));
    await interaction.reply({ embeds: [Embed.success('Rank Bind Removed', 'Bind deleted.')], ephemeral: true });
  },
};
