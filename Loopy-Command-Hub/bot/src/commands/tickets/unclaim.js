const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('unclaim').setDescription('Unclaim this ticket'),
  async execute(interaction) {
    const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [Embed.error('Not a Ticket', 'Use this in a ticket channel.')], ephemeral: true });
    db.prepare('UPDATE tickets SET claimed_by = NULL WHERE channel_id = ?').run(interaction.channelId);
    await interaction.reply({ embeds: [Embed.info('Ticket Unclaimed', 'This ticket has been unclaimed and is available for any staff member.')] });
  },
};
