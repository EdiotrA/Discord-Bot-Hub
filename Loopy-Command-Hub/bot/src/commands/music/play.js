const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

// Cache recent search results per user so the value chosen from autocomplete
// resolves instantly (no extra network call in execute).
const searchCache = new Map(); // userId → [{ title, url, duration, thumbnail }]

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song in your voice channel — type a name or paste a YouTube link')
    .addStringOption(o =>
      o.setName('query')
        .setDescription('Song name or YouTube URL')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  // Called when the user is typing — returns up to 5 search results
  async autocomplete(interaction) {
    const raw = interaction.options.getFocused();
    if (!raw || raw.length < 2) return interaction.respond([]).catch(() => {});
    try {
      const results = await Music.searchSongs(raw, 5);
      searchCache.set(interaction.user.id, results);
      const choices = results.map(r => ({
        name: `${r.title.slice(0, 80)} [${r.duration}]`,
        value: r.url,           // value is the YouTube URL → no second search needed
      }));
      return interaction.respond(choices).catch(() => {});
    } catch {
      return interaction.respond([]).catch(() => {});
    }
  },

  async execute(interaction) {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        embeds: [Embed.error('Join a Voice Channel', 'You need to be in a voice channel to use `/play`.')],
        ephemeral: true,
      });
    }
    await interaction.deferReply();
    try {
      const query = interaction.options.getString('query');

      // If the user picked from autocomplete the value is already a URL.
      // If they typed something free-form, resolve it (search or direct URL).
      let song;
      const cached = searchCache.get(interaction.user.id);
      if (cached) {
        song = cached.find(s => s.url === query);
        searchCache.delete(interaction.user.id);
      }
      if (!song) song = await Music.resolveSong(query);

      const queue = Music.ensureQueue(interaction.guildId, voiceChannel, interaction.channel);
      await Music.waitUntilReady(queue);
      Music.enqueue(queue, song);

      const isNowPlaying = queue.current?.url === song.url;
      await interaction.editReply({
        embeds: [Embed.music(
          isNowPlaying ? '🎵 Now Playing' : '➕ Added to Queue',
          `[${song.title}](${song.url})`,
          song.thumbnail,
          [
            { name: 'Duration', value: song.duration || 'live', inline: true },
            { name: 'Queue', value: `${Math.max(0, queue.songs.length - (queue.current ? 1 : 0))} song(s) waiting`, inline: true },
            { name: 'Volume', value: `${queue.volume}%`, inline: true },
          ],
        )],
      });
    } catch (err) {
      await interaction.editReply({ embeds: [Embed.error('Music Error', err.message.slice(0, 700))] });
    }
  },
};
