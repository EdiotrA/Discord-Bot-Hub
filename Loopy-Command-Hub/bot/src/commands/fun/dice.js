const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
module.exports = {
  data: new SlashCommandBuilder().setName('dice').setDescription('Roll dice')
    .addIntegerOption(o => o.setName('sides').setDescription('Sides per die (default 6)').setRequired(false).setMinValue(2).setMaxValue(100))
    .addIntegerOption(o => o.setName('count').setDescription('Number of dice (default 1)').setRequired(false).setMinValue(1).setMaxValue(10)),
  async execute(interaction) {
    const sides = interaction.options.getInteger('sides') || 6;
    const count = interaction.options.getInteger('count') || 1;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);
    await interaction.reply({ embeds: [Embed.game('🎲 Dice Roll', `Rolling ${count}d${sides}...\n\n**Results:** ${rolls.join(', ')}\n**Total:** ${total}`)] });
  },
};
