const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current song'),
  async execute(interaction) {
    const queue = Music.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [Embed.error('Nothing Playing', 'There is no active music queue.')], ephemeral: true });
    if (!Music.inVoiceChannel(interaction, queue)) return;
    queue.player.pause();
    await interaction.reply({ embeds: [Embed.music('Paused', 'Playback has been paused.')] });
  },
};