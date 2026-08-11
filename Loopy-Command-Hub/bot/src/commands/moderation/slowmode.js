const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Embed = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder().setName('slowmode').setDescription('Set channel slowmode')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('Slowmode in seconds (0 = off)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: current)').setRequired(false).addChannelTypes(ChannelType.GuildText)),
  async execute(interaction) {
    const sec = interaction.options.getInteger('seconds');
    const ch = interaction.options.getChannel('channel') || interaction.channel;
    await ch.setRateLimitPerUser(sec);
    await interaction.reply({ embeds: [Embed.success('Slowmode Set', sec === 0 ? `Slowmode disabled in ${ch}.` : `Slowmode set to **${sec}s** in ${ch}.`)], ephemeral: true });
  },
};
