const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');

const colors = { blue: 0x5865F2, green: 0x57F287, red: 0xED4245, yellow: 0xFEE75C, purple: 0x9B59B6 };

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
    const embed = new EmbedBuilder().setColor(color).setTitle(`📢 ${title}`).setDescription(message)
      .setFooter({ text: `Announced by ${interaction.user.tag}` }).setTimestamp();
    await ch.send({ content: ping ? '@everyone' : null, embeds: [embed] });
    await interaction.editReply({ embeds: [Embed.success('Announced', `Announcement sent to ${ch}!`)] });
  },
};
