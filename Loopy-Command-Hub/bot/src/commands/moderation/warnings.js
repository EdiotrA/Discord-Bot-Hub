const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('warnings').setDescription('View warnings for a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user');
    const warns = db.prepare('SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC').all(interaction.guildId, target.id);
    const embed = new EmbedBuilder().setColor(config.colors.warning).setTitle(`⚠️ Warnings — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(warns.length ? warns.map((w, i) => `**#${w.id}** <t:${w.created_at}:R>\n**Reason:** ${w.reason}\n**By:** <@${w.moderator_id}>`).join('\n\n') : 'No warnings.')
      .setFooter({ text: `Total: ${warns.length}` }).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
