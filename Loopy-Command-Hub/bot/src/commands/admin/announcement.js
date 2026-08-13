const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const config = require('../../config');

const colors = {
  blue: config.colors.primary,
  green: config.colors.success,
  red: config.colors.error,
  yellow: config.colors.gold,
  purple: config.colors.purple,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announcement')
    .setDescription('Send a professional announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(o => o.setName('message').setDescription('Announcement content').setRequired(true))
    .addStringOption(o => o.setName('color').setDescription('Embed color').setRequired(false).addChoices(
      { name: 'Blue', value: 'blue' }, { name: 'Green', value: 'green' }, { name: 'Red', value: 'red' },
      { name: 'Yellow', value: 'yellow' }, { name: 'Purple', value: 'purple' }
    ))
    .addBooleanOption(o => o.setName('pingeveryone').setDescription('Ping @everyone?').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const ch = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const message = interaction.options.getString('message');
    const color = colors[interaction.options.getString('color') || 'blue'];
    const ping = interaction.options.getBoolean('pingeveryone');
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📢  ${title}`)
      .setDescription(message)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter(Embed.brandFooter(`Announced by ${interaction.user.tag}`))
      .setTimestamp();
    await ch.send({ content: ping ? '@everyone' : null, embeds: [embed] });
    await interaction.editReply({ embeds: [Embed.success('Announcement Sent', `Your announcement has been posted in ${ch}.`)] });
  },
};
