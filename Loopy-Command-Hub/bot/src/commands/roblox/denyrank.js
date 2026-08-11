const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { handleRankDeny } = require('./acceptrank');

module.exports = {
  data: new SlashCommandBuilder().setName('denyrank').setDescription('Deny a rank request')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('requestid').setDescription('Request ID').setRequired(true)),
  async execute(interaction) { return handleRankDeny(interaction, interaction.options.getInteger('requestid')); },
};
