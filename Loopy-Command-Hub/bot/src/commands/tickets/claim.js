const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

async function handleTicketClaim(interaction) {
  const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
  if (!ticket) return interaction.reply({ embeds: [Embed.error('Not a Ticket', 'Use this in a ticket channel.')], ephemeral: true });
  if (ticket.claimed_by) return interaction.reply({ embeds: [Embed.warning('Already Claimed', `This ticket is claimed by <@${ticket.claimed_by}>.`)], ephemeral: true });
  db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(interaction.user.id, interaction.channelId);
  await interaction.reply({ embeds: [Embed.success('Ticket Claimed', `${interaction.user} has claimed this ticket and will assist you.`)] });
}

module.exports = {
  data: new SlashCommandBuilder().setName('claim').setDescription('Claim this ticket as your responsibility'),
  async execute(interaction) { return handleTicketClaim(interaction); },
  handleTicketClaim,
};
