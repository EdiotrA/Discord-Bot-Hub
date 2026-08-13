const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder().setName('volume').setDescription('Set music volume (1–100)')
    .addIntegerOption(o =>
      o.setName('level').setDescription('1 = whisper · 50 = normal · 100 = full blast')
        .setRequired(true).setMinValue(1).setMaxValue(100)
    ),
  async execute(interaction) {
    const queue = Music.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [Embed.error('Nothing Playing', 'No active music queue.')], ephemeral: true });
    if (!Music.inVoiceChannel(interaction, queue)) return;
    const level = interaction.options.getInteger('level');
    queue.volume = level;
    // Apply boosted gain so 100 = clearly loud through Discord voice
    queue.resource?.volume?.setVolume((level / 100) * Music.VOLUME_SCALE);
    const bar = '█'.repeat(Math.round(level / 10)) + '░'.repeat(10 - Math.round(level / 10));
    await interaction.reply({ embeds: [Embed.music('🔊 Volume', `\`${bar}\` **${level}%**`)] });
  },
};
