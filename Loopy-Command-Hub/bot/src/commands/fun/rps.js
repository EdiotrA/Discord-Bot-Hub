const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const choices = ['rock', 'paper', 'scissors'];
const emoji = { rock: '🪨', paper: '📄', scissors: '✂️' };
module.exports = {
  data: new SlashCommandBuilder().setName('rps').setDescription('Play Rock Paper Scissors against the bot')
    .addStringOption(o => o.setName('choice').setDescription('Your choice').setRequired(true).addChoices({ name: '🪨 Rock', value: 'rock' }, { name: '📄 Paper', value: 'paper' }, { name: '✂️ Scissors', value: 'scissors' })),
  async execute(interaction) {
    const player = interaction.options.getString('choice');
    const bot = choices[Math.floor(Math.random() * 3)];
    let result = 'draw';
    if ((player === 'rock' && bot === 'scissors') || (player === 'paper' && bot === 'rock') || (player === 'scissors' && bot === 'paper')) result = 'win';
    else if (player !== bot) result = 'lose';
    if (interaction.guild) { const action = result === 'win' ? 'wins' : result === 'lose' ? 'losses' : 'draws'; db.prepare(`INSERT INTO game_stats (guild_id, user_id, game, ${action}) VALUES (?, ?, ?, 1) ON CONFLICT(guild_id, user_id, game) DO UPDATE SET ${action} = ${action} + 1`).run(interaction.guildId, interaction.user.id, 'rps'); }
    const resultText = result === 'win' ? '🎉 You win!' : result === 'lose' ? '😢 You lose!' : '🤝 It\'s a draw!';
    const color = result === 'win' ? 0x57F287 : result === 'lose' ? 0xED4245 : 0xFEE75C;
    await interaction.reply({ embeds: [Embed.game('Rock Paper Scissors', `You: ${emoji[player]} **${player}** vs Bot: ${emoji[bot]} **${bot}**\n\n**${resultText}**`, [], color)] });
  },
};
