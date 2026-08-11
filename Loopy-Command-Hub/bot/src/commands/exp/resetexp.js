const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const ExpUtil = require('../../utils/exp');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetexp')
    .setDescription('Reset EXP for a user or the entire server [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to reset (leave empty to reset ALL server EXP)').setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [Embed.error('Permission Denied', 'You need Administrator permission to use this command.')], ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const guildId = interaction.guildId;

    if (target) {
      ExpUtil.resetExp(guildId, target.id);
      return interaction.reply({
        embeds: [Embed.success('EXP Reset', `Successfully reset all EXP for ${target}.`)],
      });
    }

    // Reset ALL server EXP — require confirmation
    await interaction.reply({
      embeds: [Embed.warning(
        'Confirm Server EXP Reset',
        '⚠️ This will **permanently delete** all EXP data for every member in this server.\n\nType `CONFIRM` in this channel within 30 seconds to proceed.'
      )],
    });

    const filter = m => m.author.id === interaction.user.id && m.content === 'CONFIRM';
    try {
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
      if (collected.first()) {
        db.prepare('DELETE FROM exp WHERE guild_id = ?').run(guildId);
        collected.first().delete().catch(() => {});
        await interaction.editReply({
          embeds: [Embed.success('Server EXP Reset', 'All EXP data for this server has been wiped.')],
        });
      }
    } catch {
      await interaction.editReply({
        embeds: [Embed.error('Timed Out', 'EXP reset cancelled — no confirmation received within 30 seconds.')],
      });
    }
  },
};
