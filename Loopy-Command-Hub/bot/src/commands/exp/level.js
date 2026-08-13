const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const ExpUtil = require('../../utils/exp');
const config = require('../../config');

function makeProgressBar(current, max, length = 12) {
  const percent = max > 0 ? Math.round((current / max) * 100) : 0;
  return `${Embed.bar(current, max, length)} ${percent}%`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level and EXP progress')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check (default: yourself)').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    const userData = ExpUtil.getUser(guildId, target.id);
    const currentLevel = ExpUtil.getLevel(userData.exp);
    const expToNext = ExpUtil.getExpToNextLevel(userData.exp);
    const rank = ExpUtil.getUserRank(guildId, target.id);

    const currentLevelExp = ExpUtil.getExpForLevel(currentLevel);
    const nextLevelExp = ExpUtil.getExpForLevel(currentLevel + 1);
    const progressExp = userData.exp - currentLevelExp;
    const totalNeeded = nextLevelExp - currentLevelExp;
    const progressBar = makeProgressBar(progressExp, totalNeeded);

    const embed = new EmbedBuilder()
      .setColor(config.colors.gold)
      .setTitle(`📈  Level Stats — ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '🏅 Level', value: `**${currentLevel}**`, inline: true },
        { name: '⭐ Total EXP', value: `**${userData.exp.toLocaleString()}**`, inline: true },
        { name: '🏆 Server Rank', value: `**#${rank}**`, inline: true },
        { name: '💬 Total Messages', value: `**${userData.total_messages?.toLocaleString() || 0}**`, inline: true },
        { name: '📊 EXP to Next Level', value: `**${expToNext.toLocaleString()}** needed`, inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '📈 Progress', value: `\`${progressBar}\`\n> ${progressExp.toLocaleString()} / ${totalNeeded.toLocaleString()} EXP`, inline: false },
      )
      .setFooter(Embed.brandFooter(`Level ${currentLevel} → Level ${currentLevel + 1}`))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
