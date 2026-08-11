const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('clearwarning').setDescription('Clear warnings from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addIntegerOption(o => o.setName('id').setDescription('Warning ID to clear (leave blank to clear all)').setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const id = interaction.options.getInteger('id');
    const gid = interaction.guildId;
    if (id) {
      db.prepare('DELETE FROM warnings WHERE id = ? AND guild_id = ? AND user_id = ?').run(id, gid, target.id);
      return interaction.reply({ embeds: [Embed.success('Warning Cleared', `Warning #${id} removed from ${target.tag}.`)], ephemeral: true });
    }
    db.prepare('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?').run(gid, target.id);
    await interaction.reply({ embeds: [Embed.success('Warnings Cleared', `All warnings cleared for **${target.tag}**.`)], ephemeral: true });
  },
};
