const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, PermissionOverwrites } = require('discord.js');
const Embed = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder().setName('lockdown').setDescription('Lock or unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('action').setDescription('Lock or unlock').setRequired(true).addChoices({ name: 'Lock', value: 'lock' }, { name: 'Unlock', value: 'unlock' }))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (default: current)').setRequired(false).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) {
    const action = interaction.options.getString('action');
    const ch = interaction.options.getChannel('channel') || interaction.channel;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const everyone = interaction.guild.roles.everyone;
    await ch.permissionOverwrites.edit(everyone, { SendMessages: action === 'lock' ? false : null }, { reason });
    const embed = action === 'lock'
      ? Embed.error('🔒 Channel Locked', `${ch} has been locked.\n**Reason:** ${reason}`)
      : Embed.success('🔓 Channel Unlocked', `${ch} has been unlocked.\n**Reason:** ${reason}`);
    await ch.send({ embeds: [embed] });
    await interaction.reply({ embeds: [Embed.success(`Channel ${action === 'lock' ? 'Locked' : 'Unlocked'}`, `Done!`)], ephemeral: true });
  },
};
