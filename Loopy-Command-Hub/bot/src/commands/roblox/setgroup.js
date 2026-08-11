const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { setSetting } = require('../../database');
const Roblox = require('../../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder().setName('setgroup').setDescription('Set the primary Roblox group for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('groupid').setDescription('Roblox group ID').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const groupId = interaction.options.getString('groupid');
    const group = await Roblox.getGroupInfo(groupId);
    if (!group) return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find Roblox group with ID \`${groupId}\`.`)] });
    setSetting(interaction.guildId, 'roblox_group_id', groupId);
    await interaction.editReply({ embeds: [Embed.roblox('Primary Group Set', `**${group.name}** is now the primary group.`, [
      { name: 'Group ID', value: groupId, inline: true },
      { name: 'Members', value: String(group.memberCount), inline: true },
      { name: 'Owner', value: group.owner?.username || 'Unknown', inline: true },
    ])] });
  },
};
