const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('verifyquestions').setDescription('List all verification questions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const questions = db.prepare('SELECT * FROM verify_questions WHERE guild_id = ? ORDER BY order_num').all(interaction.guildId);
    const embed = Embed.base({
      color: config.colors.primary,
      emoji: '🔍',
      title: 'Verification Questions',
      description: questions.length
        ? questions.map((q) => `> **${q.id}.** ${q.question}`).join('\n')
        : '*No questions set.* Use `/addverifyquestion` to add some.',
      thumbnail: interaction.guild.iconURL?.({ dynamic: true }) || null,
      footer: 'Roblox Integration',
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
