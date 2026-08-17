const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
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

    let stats = { wins: 0, losses: 0, draws: 0 };
    if (interaction.guild) {
      stats = db.prepare('SELECT wins, losses, draws FROM game_stats WHERE guild_id = ? AND user_id = ? AND game = ?')
        .get(interaction.guildId, interaction.user.id, 'rps') || stats;
    }
    const totalGames = (stats.wins || 0) + (stats.losses || 0) + (stats.draws || 0);
    const decisive = (stats.wins || 0) + (stats.losses || 0);
    const winRate = decisive > 0 ? Math.round((stats.wins / decisive) * 100) : 0;

    const resultText = result === 'win' ? '🎉 You win!' : result === 'lose' ? '😢 You lose!' : '🤝 It\'s a draw!';
    const color = result === 'win' ? config.colors.success : result === 'lose' ? config.colors.error : config.colors.warning;

    const fields = [
      Embed.field('You', `${emoji[player]} **${player.charAt(0).toUpperCase() + player.slice(1)}**`, true),
      Embed.field('Bot', `${emoji[bot]} **${bot.charAt(0).toUpperCase() + bot.slice(1)}**`, true),
      Embed.field('Result', `**${resultText}**`, true),
    ];
    if (interaction.guild) {
      fields.push(Embed.field('Record', `\`${stats.wins || 0}W · ${stats.losses || 0}L · ${stats.draws || 0}D\``, true));
      fields.push(Embed.field('Games Played', `\`${totalGames}\``, true));
      fields.push(Embed.field('Win Rate', `\`${Embed.bar(winRate, 100)}\` **${winRate}%**`, false));
    }

    const embed = Embed.base({
      color,
      title: '✊ Rock Paper Scissors ✋',
      description: `${emoji[player]} **VS** ${emoji[bot]}`,
      fields,
      thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
      footer: 'Best of luck against the bot',
    });
    await interaction.reply({ embeds: [embed] });
  },
};
