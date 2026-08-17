const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
module.exports = {
  data: new SlashCommandBuilder().setName('numberguess').setDescription('Guess the number!')
    .addIntegerOption(o => o.setName('max').setDescription('Maximum number (default 100)').setRequired(false).setMinValue(10).setMaxValue(1000)),
  async execute(interaction) {
    const max = interaction.options.getInteger('max') || 100;
    const secret = Math.floor(Math.random() * max) + 1;
    let guesses = 0; const maxGuesses = 7;
    let low = 1, high = max;

    await interaction.reply({ embeds: [Embed.base({
      color: config.colors.game,
      title: '🔢 Number Guess',
      description: [
        `I'm thinking of a number between **1** and **${max}**.`,
        '',
        `> 🎯 You have **${maxGuesses}** guesses.`,
        '> 💬 Type your guess in the chat!',
      ].join('\n'),
      thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
      footer: 'You can do it!',
    })] });

    const filter = m => m.author.id === interaction.user.id && !isNaN(m.content);
    const collector = interaction.channel.createMessageCollector({ filter, time: 120000, max: maxGuesses });
    collector.on('collect', async m => {
      guesses++; const guess = parseInt(m.content);
      if (guess === secret) {
        collector.stop('win');
        return m.reply({ embeds: [Embed.base({
          color: config.colors.gold,
          title: '🎉 Correct!',
          description: `You nailed it! The number was **${secret}**.\nSolved in **${guesses}** guess${guesses === 1 ? '' : 'es'}!`,
          thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
          footer: guesses <= 3 ? 'Incredible instincts!' : 'Well played',
        })] });
      }
      if (guesses >= maxGuesses) {
        collector.stop('lose');
        return m.reply({ embeds: [Embed.error('Game Over', `Out of guesses! The number was **${secret}**.`)] });
      }
      // Narrow the tracked range for a helpful hint.
      if (guess < secret && guess >= low) low = guess + 1;
      if (guess > secret && guess <= high) high = guess - 1;
      const remaining = maxGuesses - guesses;
      const hint = guess < secret ? '📈 Too low!' : '📉 Too high!';
      await m.reply({ embeds: [Embed.base({
        color: config.colors.warning,
        title: hint,
        description: [
          `The number is somewhere **between ${low} and ${high}**.`,
          '',
          `> Guesses left: \`${Embed.bar(remaining, maxGuesses)}\` **${remaining}**`,
        ].join('\n'),
        footer: 'Keep narrowing it down',
      })] });
    });
    collector.on('end', (_, r) => { if (r === 'time') interaction.channel.send({ embeds: [Embed.error('Timed Out', `Time's up! The number was **${secret}**.`)] }); });
  },
};
