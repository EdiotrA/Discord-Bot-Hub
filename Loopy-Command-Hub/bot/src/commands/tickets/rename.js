const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('rename').setDescription('Rename the current ticket channel')
    .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true)),
  async execute(interaction) {
    const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(interaction.channelId);
    if (!ticket) return interaction.reply({ embeds: [Embed.error('Not a Ticket', 'Use in a ticket channel.')], ephemeral: true });
    const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
    await interaction.channel.setName(`ticket-${name}`);
    await interaction.reply({ embeds: [Embed.success('Renamed', `Channel renamed to \`ticket-${name}\`.`)] });
  },
};
