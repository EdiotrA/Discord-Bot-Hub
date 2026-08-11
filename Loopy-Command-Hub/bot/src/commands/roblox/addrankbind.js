const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('addrankbind').setDescription('Bind a Roblox rank to a Discord role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('rankid').setDescription('Roblox rank ID (1-255)').setRequired(true))
    .addStringOption(o => o.setName('rankname').setDescription('Roblox rank name').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Discord role to give').setRequired(true))
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (default: server group)').setRequired(false)),
  async execute(interaction) {
    const groupId = interaction.options.getString('groupid') || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.reply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup` first.')], ephemeral: true });
    const rankId = interaction.options.getInteger('rankid');
    const rankName = interaction.options.getString('rankname');
    const role = interaction.options.getRole('role');
    db.prepare('INSERT OR REPLACE INTO rankbinds (guild_id, roblox_group_id, roblox_rank_id, roblox_rank_name, discord_role_id) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, groupId, rankId, rankName, role.id);
    await interaction.reply({ embeds: [Embed.success('Rank Bind Added', `**${rankName}** (Rank ${rankId}) → ${role}`)], ephemeral: true });
  },
};
