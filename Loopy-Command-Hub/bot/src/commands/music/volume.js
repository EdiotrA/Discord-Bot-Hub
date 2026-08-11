const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder().setName('volume').setDescription('Set music volume')
    .addIntegerOption(o => o.setName('level').setDescription('Volume from 1 to 100').setRequired(true).setMinValue(1).setMaxValue(100)),
  async execute(interaction) {
    const queue = Music.getQueue(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [Embed.error('Nothing Playing', 'There is no active music queue.')], ephemeral: true });
    if (!Music.inVoiceChannel(interaction, queue)) return;
    const level = interaction.options.getInteger('level');
    queue.volume = level;
    queue.resource?.volume?.setVolume(level / 100);
    await interaction.reply({ embeds: [Embed.music('Volume Updated', `Volume set to **${level}%**.`)] });
  },
};