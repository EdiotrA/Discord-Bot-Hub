const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('verifyquestions').setDescription('List all verification questions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const questions = db.prepare('SELECT * FROM verify_questions WHERE guild_id = ? ORDER BY order_num').all(interaction.guildId);
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('🔍 Verify Questions')
      .setDescription(questions.length ? questions.map((q, i) => `**${q.id}.** ${q.question}`).join('\n') : 'No questions set. Use `/addverifyquestion` to add some.').setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
