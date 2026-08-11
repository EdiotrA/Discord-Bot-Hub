const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const BitLife = require('../../utils/bitlife');

module.exports = {
  data: new SlashCommandBuilder().setName('bitlife').setDescription('Live a persistent text-based life')
    .addSubcommand(s => s.setName('start').setDescription('Start or restart your life'))
    .addSubcommand(s => s.setName('status').setDescription('View your current life'))
    .addSubcommand(s => s.setName('age').setDescription('Age up and face a new year'))
    .addSubcommand(s => s.setName('work').setDescription('Work for money'))
    .addSubcommand(s => s.setName('study').setDescription('Study to improve intelligence'))
    .addSubcommand(s => s.setName('relax').setDescription('Relax to improve happiness'))
    .addSubcommand(s => s.setName('exercise').setDescription('Exercise to improve health'))
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the richest active lives')),
  async execute(interaction) {
    const gid = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      const result = BitLife.start(gid, interaction.user.id);
      return interaction.reply({ embeds: [Embed.game('🌱 BitLife Started', result.existing ? 'You already have an active life.' : 'You are 18, healthy, and ready to make choices. Use `/bitlife age` to move through life.')] });
    }
    if (sub === 'leaderboard') {
      const rows = BitLife.leaderboard(gid);
      return interaction.reply({ embeds: [Embed.leaderboard('💼 BitLife Leaderboard', rows.length ? rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — age ${r.age}, ${r.cash.toLocaleString()} cash, ${r.career}`).join('\n') : 'No active lives yet.', [])] });
    }
    if (sub === 'status') {
      const profile = BitLife.ensure(gid, interaction.user.id);
      if (!profile) return interaction.reply({ embeds: [Embed.error('No Life Yet', 'Use `/bitlife start` first.')], ephemeral: true });
      return interaction.reply({ embeds: [Embed.game(profile.alive ? '🌎 Your Life' : '🪦 Life Over', `**Age:** ${profile.age}\n**Career:** ${profile.career}\n**Cash:** ${profile.cash.toLocaleString()}\n**Health:** ${profile.health}/100\n**Happiness:** ${profile.happiness}/100\n**Intelligence:** ${profile.intelligence}/100`)] });
    }
    const result = sub === 'age' ? BitLife.ageUp(gid, interaction.user.id) : BitLife.action(gid, interaction.user.id, sub);
    if (result.error) return interaction.reply({ embeds: [Embed.error('BitLife', result.error)], ephemeral: true });
    if (sub === 'age') return interaction.reply({ embeds: [Embed.game(result.died ? '🪦 End of the Road' : '🎂 New Year', result.died ? `You reached age **${result.profile.age}**. Your life has ended.` : `You are now **${result.profile.age}**. Keep making choices!`)] });
    return interaction.reply({ embeds: [Embed.success('Life Choice', `You chose to **${sub}**.\nAge **${result.profile.age}** • Cash **${result.profile.cash.toLocaleString()}** • Health **${result.profile.health}/100** • Happiness **${result.profile.happiness}/100**`)] });
  },
};