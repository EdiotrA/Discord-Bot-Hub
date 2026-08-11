const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Embed = require('../../utils/embed');
const { setSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('loachannel').setDescription('Configure the LOA system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('set').setDescription('Set the LOA review channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('reviewrole').setDescription('Set the role that can accept/deny LOAs')
      .addRoleOption(o => o.setName('role').setDescription('Reviewer role').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      setSetting(interaction.guildId, 'loa_channel', interaction.options.getChannel('channel').id);
      return interaction.reply({ embeds: [Embed.success('LOA Channel Set', `LOA requests will be posted in ${interaction.options.getChannel('channel')}.`)], ephemeral: true });
    }
    if (sub === 'reviewrole') {
      setSetting(interaction.guildId, 'loa_reviewer_role', interaction.options.getRole('role').id);
      return interaction.reply({ embeds: [Embed.success('Reviewer Role Set', `${interaction.options.getRole('role')} can now accept/deny LOA requests.`)], ephemeral: true });
    }
  },
};
