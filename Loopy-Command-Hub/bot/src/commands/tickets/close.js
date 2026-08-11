const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

async function handleTicketClose(interaction) {
  await interaction.deferReply({ ephemeral: false });
  const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
  if (!ticket) return interaction.editReply({ embeds: [Embed.error('Not a Ticket', 'This command can only be used in an open ticket channel.')] });

  // Save transcript
  const messages = await interaction.channel.messages.fetch({ limit: 100 });
  const transcript = [...messages.values()].reverse().map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[Attachment/Embed]'}`).join('\n');
  const attachment = new AttachmentBuilder(Buffer.from(transcript), { name: `ticket-${ticket.id}-transcript.txt` });

  const logChId = getSetting(ticket.guild_id, 'ticket_log_channel');
  if (logChId) {
    const lc = interaction.guild.channels.cache.get(logChId);
    if (lc) await lc.send({ embeds: [Embed.info('Ticket Closed', `**Ticket:** #${ticket.id}\n**User:** <@${ticket.user_id}>\n**Closed by:** ${interaction.user.tag}\n**Category:** ${ticket.category}`)], files: [attachment] }).catch(() => {});
  }

  db.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?").run(Math.floor(Date.now()/1000), interaction.channelId);
  await interaction.editReply({ embeds: [Embed.success('Ticket Closing', 'This ticket will be deleted in 5 seconds. Transcript saved to log channel.')] });
  setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);
}

module.exports = {
  data: new SlashCommandBuilder().setName('close').setDescription('Close the current ticket')
    .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(false)),
  async execute(interaction) { return handleTicketClose(interaction); },
  handleTicketClose,
};
