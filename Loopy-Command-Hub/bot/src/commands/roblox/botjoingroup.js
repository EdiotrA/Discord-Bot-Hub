const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Embed = require('../../utils/embed');
const Roblox = require('../../utils/roblox');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('botjoingroup').setDescription('Get information about a Roblox group and its join link')
    .addStringOption(o => o.setName('groupid').setDescription('Roblox group ID').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const groupId = interaction.options.getString('groupid');
    const group = await Roblox.getGroupInfo(groupId);
    const embed = new EmbedBuilder()
      .setColor(config.colors.roblox)
      .setTitle(`${config.emojis.roblox}  ${group?.name || 'Roblox Group'}`)
      .setDescription(group?.description?.slice(0, 500) || '*No description.*')
      .addFields(
        Embed.field('🆔 Group ID', `\`${groupId}\``, true),
        Embed.field('👥 Members', group ? Number(group.memberCount).toLocaleString() : 'Unknown', true),
        Embed.field('👑 Owner', group?.owner?.username || 'Unknown', true),
        Embed.field('⚠️ Note', 'The Roblox API does not allow bots to automatically join groups. Click the button below to join manually.', false),
      )
      .setFooter(Embed.brandFooter('Roblox Integration • Manual join required'))
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Join Group on Roblox').setStyle(ButtonStyle.Link).setURL(`https://www.roblox.com/groups/${groupId}`).setEmoji('🟥'),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
