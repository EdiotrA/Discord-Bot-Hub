const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const Embed = require('../../utils/embed');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post Loopy’s click-ready member command panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Where to post the panel (defaults to this channel)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('Loopy Command Hub')
      .setDescription('Everything below is ready to click. Members can start verification, open support, get economy options, browse Mog, or ask Loopy for help without remembering command names.')
      .addFields(
        { name: 'Verification', value: 'Start Roblox verification from a button.', inline: true },
        { name: 'Support', value: 'Open a ticket in one click.', inline: true },
        { name: 'Mog & Economy', value: 'Open profiles, shops, daily coins, and bets.', inline: true },
        { name: 'AI Helper', value: 'Ask about coding, UI, debugging, or server questions.', inline: true },
      )
      .setFooter({ text: interaction.guild.name })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hub:verify').setLabel('Verify').setStyle(ButtonStyle.Primary).setEmoji('🔍'),
      new ButtonBuilder().setCustomId('hub:ticket').setLabel('Open Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫'),
      new ButtonBuilder().setCustomId('hub:economy').setLabel('Economy').setStyle(ButtonStyle.Secondary).setEmoji('🪙'),
      new ButtonBuilder().setCustomId('hub:mog').setLabel('Mog Hub').setStyle(ButtonStyle.Secondary).setEmoji('😎'),
      new ButtonBuilder().setCustomId('hub:assistant').setLabel('Ask Loopy').setStyle(ButtonStyle.Primary).setEmoji('🤖'),
    );
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      embeds: [Embed.success('Command Hub Posted', `Members can use the click-ready panel in ${channel}.`)],
      ephemeral: true,
    });
  },
};