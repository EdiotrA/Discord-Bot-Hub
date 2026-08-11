const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const Embed = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get Loopy invite links for another server'),

  async execute(interaction) {
    const permissions = PermissionsBitField.resolve([
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'ReadMessageHistory',
      'ManageMessages',
      'ManageChannels',
      'ManageRoles',
      'Connect',
      'Speak',
      'UseVAD',
      'ModerateMembers',
    ]).toString();
    const botInvite = `https://discord.com/oauth2/authorize?client_id=${interaction.client.application.id}&scope=bot%20applications.commands&permissions=${permissions}`;
    await interaction.reply({
      embeds: [Embed.info(
        'Add Loopy to a Server',
        `Use this link to choose a server and review the permissions before adding Loopy:\n\n[Add Loopy to a server](${botInvite})\n\nDiscord always shows the server and permission approval screen. Loopy cannot see or join servers without that explicit approval.`,
      )],
      ephemeral: true,
    });
  },
};