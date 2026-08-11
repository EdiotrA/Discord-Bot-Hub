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
    .setName('verifypanel')
    .setDescription('Post a click-to-start Roblox verification panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Where to post the panel (defaults to this channel)')
      .setRequired(false)
      .addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o
      .setName('title')
      .setDescription('Optional panel title')
      .setRequired(false)
      .setMaxLength(100))
    .addStringOption(o => o
      .setName('description')
      .setDescription('Optional panel description')
      .setRequired(false)
      .setMaxLength(1_000)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || 'Roblox Verification';
    const description = interaction.options.getString('description')
      || 'Click below to start verification. Loopy will check your Roblox profile and give you the configured verified role.';
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: interaction.guild.name })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_start')
        .setLabel('Start Verification')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔍'),
    );

    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      embeds: [Embed.success('Verify Panel Posted', `The panel is ready in ${channel}. Members only need to click the button.`)],
      ephemeral: true,
    });
  },
};