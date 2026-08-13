const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const gameList = [
  { name: '🎱 /8ball', desc: 'Ask the magic 8-ball a question' },
  { name: '🪨 /rps', desc: 'Rock Paper Scissors against the bot' },
  { name: '🪙 /coinflip', desc: 'Flip a coin' },
  { name: '🎲 /dice', desc: 'Roll dice with custom sides/count' },
  { name: '🎯 /trivia', desc: 'Answer trivia questions' },
  { name: '❌ /tictactoe', desc: 'Tic Tac Toe with another user' },
  { name: '🔢 /numberguess', desc: 'Guess the secret number' },
  { name: '🎰 /slots', desc: 'Spin the slot machine' },
  { name: '🤔 /wouldyourather', desc: 'Would you rather questions' },
  { name: '🔥 /roast', desc: 'Get roasted (friendly!)' },
  { name: '💝 /compliment', desc: 'Give someone a compliment' },
  { name: '😄 /joke', desc: 'Get a random joke' },
  { name: '👨 /dadjoke', desc: 'Dad jokes' },
  { name: '🤓 /fact', desc: 'Random fun facts' },
  { name: '🖼️ /meme', desc: 'Random meme' },
  { name: '🥠 /fortune', desc: 'Fortune cookie message' },
  { name: '📊 /poll', desc: 'Create a poll' },
];
module.exports = {
  data: new SlashCommandBuilder().setName('games').setDescription('List all available games and fun commands'),
  async execute(interaction) {
    const embed = Embed.base({
      color: config.colors.game,
      emoji: config.emojis.game,
      title: 'Loopy Games & Fun',
      description: `${Embed.divider}\n${gameList.map(g => `${g.name} — ${g.desc}`).join('\n')}\n${Embed.divider}`,
      thumbnail: interaction.guild?.iconURL({ dynamic: true }) || undefined,
      footer: 'Use any command to start playing!',
    });
    await interaction.reply({ embeds: [embed] });
  },
  handleGameButton: async (interaction) => { await interaction.reply({ content: 'Game action handled!', ephemeral: true }); },
};
