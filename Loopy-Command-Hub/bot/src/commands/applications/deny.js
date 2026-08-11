const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleAppDeny } = require('./accept');

module.exports = {
  data: new SlashCommandBuilder().setName('deny').setDescription('Deny an application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('appid').setDescription('Application ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) { return handleAppDeny(interaction, interaction.options.getInteger('appid')); },
  handleAppDeny,
};
