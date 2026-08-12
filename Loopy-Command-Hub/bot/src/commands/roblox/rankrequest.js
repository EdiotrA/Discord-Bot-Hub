const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const config = require('../../config');

async function handleRankModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const gid = interaction.guild.id;
  const groupId = getSetting(gid, 'roblox_group_id');
  if (!groupId) return interaction.editReply({ embeds: [Embed.error('No Group', 'Server has no Roblox group set.')] });

  const targetUsername = interaction.fields.getTextInputValue('target_username');
  const requestedRank = interaction.fields.getTextInputValue('requested_rank');
  const reason = interaction.fields.getTextInputValue('reason');

  const [myVerify, targetUser] = await Promise.all([
    db.prepare('SELECT roblox_user_id FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(gid, interaction.user.id),
    Roblox.getUserByUsername(targetUsername),
  ]);
  if (!myVerify) return interaction.editReply({ embeds: [Embed.error('Not Verified', 'You must be verified to submit rank requests.')] });
  if (!targetUser) return interaction.editReply({ embeds: [Embed.error('Not Found', `Roblox user \`${targetUsername}\` not found.`)] });

  const [myRank, targetRank, allRoles] = await Promise.all([
    Roblox.getUserGroupRank(myVerify.roblox_user_id, groupId),
    Roblox.getUserGroupRank(targetUser.id, groupId),
    Roblox.getGroupRoles(groupId),
  ]);
  const desiredRole = allRoles.find(r => r.name.toLowerCase() === requestedRank.toLowerCase() || String(r.rank) === requestedRank);
  if (!desiredRole) return interaction.editReply({ embeds: [Embed.error('Invalid Rank', `Rank \`${requestedRank}\` not found. Use \`/rank\` to see valid ranks.`)] });
  if (!myRank || (desiredRole.rank >= myRank.rank)) return interaction.editReply({ embeds: [Embed.error('Permission Denied', 'You can only rank users to ranks below your own.')] });

  // Store both the rank number (for display) and the actual Roblox role ID
  // (required by the Open Cloud API when the request is accepted).
  const id = db.prepare(
    'INSERT INTO rank_requests (guild_id, requester_id, target_user_id, roblox_group_id, current_rank_id, requested_rank_id, requested_rank_name, requested_role_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(gid, interaction.user.id, String(targetUser.id), groupId, targetRank?.rank || 0, desiredRole.rank, desiredRole.name, desiredRole.id).lastInsertRowid;

  const logCh = getSetting(gid, 'rank_log_channel');
  if (logCh) {
    const ch = interaction.guild.channels.cache.get(logCh);
    if (ch) {
      const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('🟥 Rank Request').addFields(
        { name: 'Requester', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
        { name: 'Target', value: `${targetUsername} (ID: ${targetUser.id})`, inline: true },
        { name: 'Current Rank', value: targetRank?.name || 'Guest', inline: true },
        { name: 'Requested Rank', value: desiredRole.name, inline: true },
        { name: 'Reason', value: reason },
      ).setTimestamp().setFooter({ text: `Request #${id}` });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rank_accept:${id}`).setLabel('Accept & Rank').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`rank_deny:${id}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
      );
      await ch.send({ embeds: [embed], components: [row] });
    }
  }
  await interaction.editReply({ embeds: [Embed.success('Rank Request Submitted', `Request #${id} submitted.\nTarget: **${targetUsername}** → **${desiredRole.name}**`)] });
}

module.exports = {
  data: new SlashCommandBuilder().setName('rankrequest').setDescription('Submit a rank request for a Roblox user'),
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('rank_modal').setTitle('Rank Request')
      .addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target_username').setLabel('Target Roblox Username').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('requested_rank').setLabel('Rank Name or Number').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true)),
      );
    await interaction.showModal(modal);
  },
  handleRankModal,
};
