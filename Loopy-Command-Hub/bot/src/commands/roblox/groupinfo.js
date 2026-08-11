const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder().setName('groupinfo').setDescription('Get Roblox group information')
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (default: server group)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const groupId = interaction.options.getString('groupid') || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.editReply({ embeds: [Embed.error('No Group', 'No group ID provided and no server group set. Use `/setgroup` first.')] });
    const group = await Roblox.getGroupInfo(groupId);
    if (!group) return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find group \`${groupId}\`.`)] });
    await interaction.editReply({ embeds: [Embed.roblox(group.name, group.description?.slice(0, 400) || 'No description', [
      { name: 'Group ID', value: String(group.id), inline: true },
      { name: 'Members', value: String(group.memberCount), inline: true },
      { name: 'Owner', value: group.owner?.username || 'None', inline: true },
      { name: 'Link', value: `[View Group](https://www.roblox.com/groups/${group.id})`, inline: true },
    ])] });
  },
};
