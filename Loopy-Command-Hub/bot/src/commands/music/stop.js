const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear the queue'),
  async execute(interaction) {
    const queue = Music.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [Embed.error('Nothing Playing', 'There is no active music queue.')], ephemeral: true });
    if (!Music.inVoiceChannel(interaction, queue)) return;
    Music.stop(queue);
    await interaction.reply({ embeds: [Embed.music('Music Stopped', 'Playback stopped and the queue was cleared.')] });
  },
};