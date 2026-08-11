const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Roblox = require('../../utils/roblox');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('botjoingroup').setDescription('Get information about a Roblox group and its join link')
    .addStringOption(o => o.setName('groupid').setDescription('Roblox group ID').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const groupId = interaction.options.getString('groupid');
    const group = await Roblox.getGroupInfo(groupId);
    const embed = new EmbedBuilder().setColor(0xFF0000).setTitle(`🟥 ${group?.name || 'Roblox Group'}`)
      .setDescription(group?.description?.slice(0, 500) || 'No description.')
      .addFields(
        { name: 'Group ID', value: groupId, inline: true },
        { name: 'Members', value: group ? String(group.memberCount) : 'Unknown', inline: true },
        { name: 'Owner', value: group?.owner?.username || 'Unknown', inline: true },
        { name: '⚠️ Note', value: 'The Roblox API does not allow bots to automatically join groups. Click the button below to join manually.' },
      ).setTimestamp().setFooter({ text: 'Roblox Open Cloud API • Manual join required' });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Join Group on Roblox').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/groups/${groupId}`).setEmoji('🟥'),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
