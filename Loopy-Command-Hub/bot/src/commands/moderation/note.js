const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('note').setDescription('Add a staff note about a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('note').setDescription('Note content').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const note = interaction.options.getString('note');
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'NOTE', interaction.user.id, target.id, note);
    await interaction.reply({ embeds: [Embed.success('Note Added', `Note added for **${target.tag}**:\n> ${note}`)], ephemeral: true });
  },
};
