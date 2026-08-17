const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const flavors = [
  'It spins through the air...',
  'A flick of the thumb sends it soaring...',
  'Tumbling end over end...',
  'The coin catches the light as it flips...',
  'Heads or tails? Only fate decides...',
];
module.exports = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
  async execute(interaction) {
    const heads = Math.random() < 0.5;
    const result = heads ? 'Heads' : 'Tails';
    const face = heads ? '🪙' : '💿';
    const flavor = flavors[Math.floor(Math.random() * flavors.length)];
    const embed = Embed.base({
      color: config.colors.gold,
      title: '🪙 Coin Flip',
      description: [
        `*${flavor}*`,
        '',
        '```',
        `        ${face}`,
        `      ${result.toUpperCase()}`,
        '```',
        `The coin landed on **${result}**!`,
      ].join('\n'),
      thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
      footer: 'Want to bet coins on it? Try the /games arcade',
    });
    await interaction.reply({ embeds: [embed] });
  },
};
