const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const { checkPermission, deny } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove a timeout from a member')
    .addUserOption(o => o.setName('user').setDescription('The member to remove the timeout from').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for removing the timeout')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!(await checkPermission(interaction, 'untimeout'))) return deny(interaction);

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const { guild } = interaction;

    const targetMember = guild.members.cache.get(target.id);
    if (!targetMember)
      return interaction.editReply({ embeds: [Embed.error('Not Found', 'That user is not in this server.')] });

    if (!targetMember.communicationDisabledUntilTimestamp || targetMember.communicationDisabledUntilTimestamp <= Date.now()) {
      return interaction.editReply({
        embeds: [Embed.info('No Active Timeout', `${target} does not have an active timeout.`)],
      });
    }

    await targetMember.timeout(null, reason);

    // DM user
    try {
      await target.send({
        embeds: [Embed.success('Timeout Removed', `Your timeout in **${guild.name}** has been removed.\n**Reason:** ${reason}`)],
      });
    } catch { /* DMs disabled */ }

    // Log to mod_logs
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)')
      .run(guild.id, 'UNTIMEOUT', interaction.user.id, target.id, reason);

    // Log to log channel
    const logChannelId = getSetting(guild.id, 'log_channel');
    if (logChannelId) {
      const logChannel = guild.channels.cache.get(logChannelId);
      if (logChannel) {
        await logChannel.send({
          embeds: [Embed.moderation('Timeout Removed', target, interaction.user, reason)],
        }).catch(() => {});
      }
    }

    return interaction.editReply({
      embeds: [Embed.success('Timeout Removed', `${target.tag}'s timeout has been removed.\n**Reason:** ${reason}`)],
    });
  },
};
