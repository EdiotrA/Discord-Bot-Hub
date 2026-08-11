const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('add').setDescription('Add a user to the current ticket')
    .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)),
  async execute(interaction) {
    const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [Embed.error('Not a Ticket', 'Use this in a ticket channel.')], ephemeral: true });
    const user = interaction.options.getUser('user');
    await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await interaction.reply({ embeds: [Embed.success('User Added', `${user} has been added to this ticket.`)] });
  },
};
