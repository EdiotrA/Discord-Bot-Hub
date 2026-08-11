const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('remove').setDescription('Remove a user from the current ticket')
    .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)),
  async execute(interaction) {
    const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [Embed.error('Not a Ticket', 'Use this in a ticket channel.')], ephemeral: true });
    const user = interaction.options.getUser('user');
    await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
    await interaction.reply({ embeds: [Embed.success('User Removed', `${user} has been removed from this ticket.`)] });
  },
};
