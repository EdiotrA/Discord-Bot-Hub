const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const config = require('../../config');

function checkWin(board) {
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of wins) if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a];
  return board.every(Boolean) ? 'draw' : null;
}
function renderBoard(board) {
  const map = { X: '❌', O: '⭕', null: '⬜' };
  return [0,3,6].map(i => [0,1,2].map(j => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`game_ttt_${i+j}`).setLabel(board[i+j] || '\u200b').setStyle(board[i+j] ? (board[i+j] === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary) : ButtonStyle.Secondary).setDisabled(!!board[i+j]).setEmoji(map[board[i+j]])
  )).flatMap(r => r.components)).reduce((rows, btn, idx) => { const r = Math.floor(idx/3); if (!rows[r]) rows[r] = new ActionRowBuilder(); rows[r].addComponents(btn); return rows; }, []).filter(Boolean);
}

module.exports = {
  data: new SlashCommandBuilder().setName('tictactoe').setDescription('Play Tic Tac Toe')
    .addUserOption(o => o.setName('opponent').setDescription('Opponent').setRequired(true)),
  async execute(interaction) {
    const opp = interaction.options.getMember('opponent');
    if (!opp || opp.user.bot || opp.id === interaction.user.id) return interaction.reply({ embeds: [Embed.error('Invalid', 'Choose a valid human opponent.')], ephemeral: true });
    const board = Array(9).fill(null);
    let turn = 'X';
    const players = { X: interaction.user.id, O: opp.user.id };
    const embed = () => new EmbedBuilder().setColor(config.colors.primary).setTitle('❌ Tic Tac Toe ⭕').setDescription(`${turn === 'X' ? `<@${players.X}>` : `<@${players.O}>`}'s turn (${turn})`).setTimestamp();
    const rows = () => board.reduce((acc, _, i) => { const ri = Math.floor(i/3); if (!acc[ri]) acc[ri] = new ActionRowBuilder(); acc[ri].addComponents(new ButtonBuilder().setCustomId(`ttt_${i}`).setLabel(board[i] === 'X' ? '❌' : board[i] === 'O' ? '⭕' : '\u200b').setStyle(board[i] === 'X' ? ButtonStyle.Danger : board[i] === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(!!board[i])); return acc; }, []);
    await interaction.reply({ content: `${opp}, you've been challenged to Tic Tac Toe by ${interaction.user}!`, embeds: [embed()], components: rows() });
    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ time: 300000 });
    collector.on('collect', async i => {
      const currentPlayerId = players[turn];
      if (i.user.id !== currentPlayerId) return i.reply({ content: 'It\'s not your turn!', ephemeral: true });
      const idx = parseInt(i.customId.split('_')[1]);
      board[idx] = turn;
      const winner = checkWin(board);
      if (winner) {
        collector.stop();
        const disabledRows = rows().map(r => { r.components.forEach(b => b.setDisabled(true)); return r; });
        const msg2 = winner === 'draw' ? '🤝 It\'s a draw!' : `🎉 <@${players[winner]}> wins!`;
        return i.update({ embeds: [new EmbedBuilder().setColor(winner === 'draw' ? 0xFEE75C : 0x57F287).setTitle('Game Over!').setDescription(msg2).setTimestamp()], components: disabledRows });
      }
      turn = turn === 'X' ? 'O' : 'X';
      await i.update({ embeds: [embed()], components: rows() });
    });
    collector.on('end', async (_, r) => { if (r === 'time') await msg.edit({ components: [] }).catch(() => {}); });
  },
};
