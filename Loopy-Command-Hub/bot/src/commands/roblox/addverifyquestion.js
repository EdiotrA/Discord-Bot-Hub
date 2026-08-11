const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('addverifyquestion').setDescription('Add an AI-evaluated verification question')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('question').setDescription('The question to ask applicants').setRequired(true)),
  async execute(interaction) {
    const q = interaction.options.getString('question');
    const count = db.prepare('SELECT COUNT(*) as c FROM verify_questions WHERE guild_id = ?').get(interaction.guildId).c;
    db.prepare('INSERT INTO verify_questions (guild_id, question, order_num) VALUES (?, ?, ?)').run(interaction.guildId, q, count);
    await interaction.reply({ embeds: [Embed.success('Question Added', `Verify question added:\n> ${q}`)], ephemeral: true });
  },
};
