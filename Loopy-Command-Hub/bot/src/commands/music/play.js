const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or playlist in your voice channel')
    .addStringOption(o => o.setName('query').setDescription('Song name or URL').setRequired(true)),
  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ embeds: [Embed.error('Join a Voice Channel', 'Join a voice channel before using `/play`.')], ephemeral: true });
    }
    await interaction.deferReply();
    try {
      const query = interaction.options.getString('query');
      const song = await Music.resolveSong(query);
       const queue = Music.ensureQueue(interaction.guildId, voiceChannel, interaction.channel);
       await Music.waitUntilReady(queue);
      Music.enqueue(queue, song);
      await interaction.editReply({ embeds: [Embed.music(queue.current?.url === song.url ? 'Now Playing' : 'Added to Queue', `[${song.title}](${song.url})`, song.thumbnail, [
        { name: 'Duration', value: song.duration, inline: true },
        { name: 'Queue', value: `${Math.max(0, queue.songs.length - (queue.current ? 1 : 0))} queued`, inline: true },
      ])] });
    } catch (err) {
      await interaction.editReply({ embeds: [Embed.error('Music Error', err.message.slice(0, 700))] });
    }
  },
};