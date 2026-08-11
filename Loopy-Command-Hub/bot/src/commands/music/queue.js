const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder().setName('queue').setDescription('Show the current music queue'),
  async execute(interaction) {
    const queue = Music.getQueue(interaction.guildId);
    if (!queue || !queue.songs?.length) {
      return interaction.reply({ embeds: [Embed.error('Queue Empty', 'There is no active music queue.')] });
    }
    if (!Music.inVoiceChannel(interaction, queue)) return;
    const lines = queue.songs.slice(0, 15).map((song, i) =>
      `${i === 0 ? '▶️' : `**${i}.**`} [${song.title.slice(0, 80)}](${song.url}) — \`${song.duration || 'live'}\``
    );
    await interaction.reply({ embeds: [Embed.music('Music Queue', lines.join('\n'), null, [
      { name: 'Total Songs', value: String(queue.songs.length), inline: true },
      { name: 'Volume', value: `${queue.volume}%`, inline: true },
      { name: 'Repeat', value: queue.loop, inline: true },
    ])] });
  },
};