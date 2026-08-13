const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

const MODE_LABELS = {
  off:   { emoji: '➡️',  label: 'Off',        desc: 'Plays through the queue once, then stops.' },
  song:  { emoji: '🔂',  label: 'Repeat Song', desc: 'Repeats the current song forever.' },
  queue: { emoji: '🔁',  label: 'Repeat Queue', desc: 'Loops the entire queue forever — never stops unless you `/stop`.' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set or toggle the repeat mode')
    .addStringOption(o =>
      o.setName('mode')
        .setDescription('Choose a repeat mode')
        .setRequired(false)
        .addChoices(
          { name: '➡️  Off — play through once then stop', value: 'off' },
          { name: '🔂  Repeat Song — replay current song forever', value: 'song' },
          { name: '🔁  Repeat Queue — loop entire queue forever', value: 'queue' },
        )
    ),
  async execute(interaction) {
    const queue = Music.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [Embed.error('Nothing Playing', 'No active music queue.')], ephemeral: true });
    if (!Music.inVoiceChannel(interaction, queue)) return;

    const requested = interaction.options.getString('mode');
    if (requested) {
      Music.setLoop(queue, requested);
    } else {
      // Toggle: off → queue → song → off
      const cycle = { off: 'queue', queue: 'song', song: 'off' };
      Music.setLoop(queue, cycle[queue.loop] || 'queue');
    }

    const { emoji, label, desc } = MODE_LABELS[queue.loop];
    await interaction.reply({ embeds: [Embed.music(`${emoji} Loop — ${label}`, desc)] });
  },
};
