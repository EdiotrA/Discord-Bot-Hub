const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
module.exports = {
  data: new SlashCommandBuilder().setName('numberguess').setDescription('Guess the number!')
    .addIntegerOption(o => o.setName('max').setDescription('Maximum number (default 100)').setRequired(false).setMinValue(10).setMaxValue(1000)),
  async execute(interaction) {
    const max = interaction.options.getInteger('max') || 100;
    const secret = Math.floor(Math.random() * max) + 1;
    let guesses = 0; const maxGuesses = 7;
    await interaction.reply({ embeds: [Embed.game('🔢 Number Guess', `I'm thinking of a number between **1** and **${max}**.\nYou have **${maxGuesses}** guesses. Type your guess in the chat!`)] });
    const filter = m => m.author.id === interaction.user.id && !isNaN(m.content);
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: maxGuesses });
    collector.on('collect', async m => {
      guesses++; const guess = parseInt(m.content);
      if (guess === secret) { collector.stop('win'); return m.reply({ embeds: [Embed.success('🎉 Correct!', `You got it! The number was **${secret}** in **${guesses}** guess(es)!`)] }); }
      if (guesses >= maxGuesses) { collector.stop('lose'); return m.reply({ embeds: [Embed.error('Game Over!', `Out of guesses! The number was **${secret}**.`)] }); }
      const hint = guess < secret ? '📈 Too low!' : '📉 Too high!';
      await m.reply({ embeds: [Embed.game('Hint', `${hint} ${maxGuesses - guesses} guess(es) remaining.`)] });
    });
    collector.on('end', (_, r) => { if (r === 'time') interaction.channel.send({ embeds: [Embed.error('Timed Out', `Time\'s up! The number was **${secret}**.`)] }); });
  },
};
