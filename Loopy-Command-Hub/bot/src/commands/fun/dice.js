const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const faceFor = (n, sides) => (sides === 6 && DIE_FACES[n] ? DIE_FACES[n] : '🎲');
module.exports = {
  data: new SlashCommandBuilder().setName('dice').setDescription('Roll dice')
    .addIntegerOption(o => o.setName('sides').setDescription('Sides per die (default 6)').setRequired(false).setMinValue(2).setMaxValue(100))
    .addIntegerOption(o => o.setName('count').setDescription('Number of dice (default 1)').setRequired(false).setMinValue(1).setMaxValue(10)),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const count = interaction.options.getInteger('count') || 1;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);
    const maxPossible = sides * count;
    const perfect = total === maxPossible;

    const faces = rolls.map(r => faceFor(r, sides)).join(' ');
    const table = [
      '```',
      `Roll   ${count}d${sides}`,
      `Dice   ${rolls.join('  ')}`,
      `Total  ${total} / ${maxPossible}`,
      '```',
    ].join('\n');

    const embed = Embed.base({
      color: perfect ? config.colors.gold : config.colors.game,
      title: '🎲 Dice Roll',
      description: [
        `${faces}`,
        '',
        table,
        perfect ? '**✨ PERFECT ROLL! ✨** Every die hit its max!' : `You rolled a total of **${total}**.`,
      ].join('\n'),
      thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
      footer: perfect ? 'A one-in-a-million throw' : `Max possible: ${maxPossible}`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};
