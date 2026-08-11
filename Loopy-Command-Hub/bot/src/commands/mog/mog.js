const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Mog = require('../../utils/mog');

const types = [
  { name: 'Pet', value: 'pets' },
  { name: 'Aura', value: 'auras' },
  { name: 'Power', value: 'powers' },
];

module.exports = {
  data: new SlashCommandBuilder().setName('mog').setDescription('Challenge members and collect Mog advantages')
    .addSubcommand(s => s.setName('challenge').setDescription('Try to mog another member')
      .addUserOption(o => o.setName('user').setDescription('Member to challenge').setRequired(true)))
    .addSubcommand(s => s.setName('profile').setDescription('View your Mog profile')
      .addUserOption(o => o.setName('user').setDescription('Member to view').setRequired(false)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the Mog point leaderboard'))
    .addSubcommand(s => s.setName('shop').setDescription('View pets, auras, and powers'))
    .addSubcommand(s => s.setName('inventory').setDescription('View your owned Mog items'))
    .addSubcommand(s => s.setName('buy').setDescription('Buy a Mog advantage')
      .addStringOption(o => o.setName('type').setDescription('Item type').setRequired(true).addChoices(...types))
      .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true)))
    .addSubcommand(s => s.setName('equip').setDescription('Equip an owned Mog advantage')
      .addStringOption(o => o.setName('type').setDescription('Item type').setRequired(true).addChoices(...types))
      .addStringOption(o => o.setName('item').setDescription('Item name').setRequired(true))),
  async execute(interaction) {
    const gid = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    if (sub === 'challenge') {
      const target = interaction.options.getUser('user');
      if (target.bot || target.id === interaction.user.id) return interaction.reply({ embeds: [Embed.error('Invalid Challenge', 'Choose another human member.')], ephemeral: true });
      const result = Mog.challenge(gid, interaction.user.id, target.id);
      const winner = result.winnerId === interaction.user.id ? interaction.user : target;
      const loser = result.loserId === interaction.user.id ? interaction.user : target;
      return interaction.reply({ embeds: [Embed.game(result.won ? '👑 You Mogged Them!' : '💀 You Got Mogged!', `${winner} won the face-off against ${loser} and earned **+1 Mog Point**.\n\n**Scores:** ${interaction.user} ${result.winnerId === interaction.user.id ? result.winnerScore : result.loserScore} • ${target} ${result.winnerId === target.id ? result.winnerScore : result.loserScore}`)] });
    }
    if (sub === 'profile') {
      const user = interaction.options.getUser('user') || interaction.user;
      const profile = Mog.ensureProfile(gid, user.id);
      return interaction.reply({ embeds: [Embed.game('😎 Mog Profile', `${user}\n\n**Mog Points:** ${profile.points}\n**Wins:** ${profile.wins} • **Losses:** ${profile.losses}\n**Pet:** \`${profile.pet}\`\n**Aura:** \`${profile.aura}\`\n**Power:** \`${profile.power}\``)] });
    }
    if (sub === 'leaderboard') {
      const rows = Mog.leaderboard(gid);
      return interaction.reply({ embeds: [Embed.leaderboard('👑 Mog Leaderboard', rows.length ? rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${r.user_id}> — **${r.points}** points (${r.wins}W/${r.losses}L)`).join('\n') : 'No Mog matches have been played yet.', [])] });
    }
    if (sub === 'shop') return interaction.reply({ embeds: [Embed.info('🛍️ Mog Shop', Mog.shopLines().join('\n'))] });
    if (sub === 'inventory') {
      const items = Mog.inventory(gid, interaction.user.id);
      return interaction.reply({ embeds: [Embed.info('🎒 Mog Inventory', items.length ? items.map(item => `**${item.item_type.slice(0, -1)}:** \`${item.item_name}\``).join('\n') : 'Your inventory is empty. Use `/mog shop` to browse items.')] });
    }
    const type = interaction.options.getString('type');
    const name = interaction.options.getString('item').toLowerCase();
    const result = sub === 'buy' ? Mog.buy(gid, interaction.user.id, type, name) : Mog.equip(gid, interaction.user.id, type, name);
    if (result.error) return interaction.reply({ embeds: [Embed.error('Mog Item', result.error)], ephemeral: true });
    return interaction.reply({ embeds: [Embed.success(sub === 'buy' ? 'Item Purchased' : 'Item Equipped', `You ${sub === 'buy' ? 'bought' : 'equipped'} **${result.item.label}** (${result.item.description}).`)] });
  },
};