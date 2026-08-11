const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
module.exports = {
  data: new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin'),
  async execute(interaction) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await interaction.reply({ embeds: [Embed.game('Coin Flip', `${result === 'Heads' ? '🪙' : '💿'} The coin landed on **${result}**!`)] });
  },
};
