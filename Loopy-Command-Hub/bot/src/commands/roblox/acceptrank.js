const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const { decrypt } = require('../../utils/crypto');

/** Fetch and decrypt this guild's Roblox Open Cloud API key, if set. */
function getGuildApiKey(guildId) {
  const stored = getSetting(guildId, 'roblox_api_key');
  return stored ? decrypt(stored) : null;
}

/**
 * Check whether the interacting member is authorised to accept/deny rank
 * requests. They must have Manage Guild permission (server admin / owner).
 * This runs for both the slash-command path and the button path, because
 * component interactions do NOT inherit slash-command default permissions.
 */
function isAuthorizedReviewer(interaction) {
  // interaction.member is present for guild interactions; fall back to
  // checking the permission bit on the resolved member permissions.
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

async function handleRankAccept(interaction, requestId) {
  await interaction.deferReply({ ephemeral: true });

  // Authorization: ManageGuild required for both slash and button paths.
  if (!isAuthorizedReviewer(interaction)) {
    return interaction.editReply({ embeds: [Embed.error('Unauthorized', 'You need the **Manage Server** permission to accept rank requests.')] });
  }

  const id = requestId || interaction.options?.getInteger('requestid');
  const req = db.prepare('SELECT * FROM rank_requests WHERE id = ?').get(id);
  if (!req) return interaction.editReply({ embeds: [Embed.error('Not Found', `Rank request #${id} not found.`)] });

  // Guild isolation: the request must belong to the server where the
  // interaction originates. Without this check an admin in any other guild
  // could accept/deny a request by guessing its globally-autoincrement ID.
  if (req.guild_id !== interaction.guildId) {
    return interaction.editReply({ embeds: [Embed.error('Wrong Server', 'This rank request belongs to a different server.')] });
  }

  if (req.status !== 'pending') return interaction.editReply({ embeds: [Embed.error('Already Handled', 'This request has already been processed.')] });

  // Rank-ceiling check: reviewer must be verified AND outrank the target rank.
  // If the reviewer has no Roblox verification we cannot confirm their rank,
  // so we deny by default — only verified admins can approve rank changes.
  const myVerify = db.prepare('SELECT roblox_user_id FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(req.guild_id, interaction.user.id);
  if (!myVerify) {
    return interaction.editReply({ embeds: [Embed.error('Not Verified', 'You must link your Roblox account with `/verify` before accepting rank requests. This ensures you outrank the requested role.')] });
  }
  const myRank = await Roblox.getUserGroupRank(myVerify.roblox_user_id, req.roblox_group_id);
  if (!myRank) {
    return interaction.editReply({ embeds: [Embed.error('Not in Group', 'You are not a member of this Roblox group and cannot approve rank changes.')] });
  }
  if (req.requested_rank_id >= myRank.rank) {
    return interaction.editReply({ embeds: [Embed.error('Permission Denied', `You cannot rank someone to **${req.requested_rank_name}** (rank ${req.requested_rank_id}) because that rank is equal to or higher than your own (rank ${myRank.rank}).`)] });
  }

  // Prefer the stored Roblox role ID (actual large int); fall back to looking
  // it up by rank number for requests created before this column was added.
  let roleId = req.requested_role_id;
  if (!roleId) {
    const allRoles = await Roblox.getGroupRoles(req.roblox_group_id);
    const role = allRoles.find(r => r.rank === req.requested_rank_id);
    if (!role) {
      return interaction.editReply({ embeds: [Embed.error('Role Not Found', `Could not find a Roblox role with rank number ${req.requested_rank_id}. The role may have been deleted.`)] });
    }
    roleId = role.id;
  }

  const result = await Roblox.setUserRank(req.roblox_group_id, req.target_user_id, roleId, {
    openCloudKey: getGuildApiKey(req.guild_id),
  });
  if (!result.success) {
    return interaction.editReply({ embeds: [Embed.error('Rank Failed', `Could not set rank: ${result.error}`)] });
  }
  db.prepare("UPDATE rank_requests SET status = 'accepted', reviewed_by = ? WHERE id = ?").run(interaction.user.id, id);
  const requester = await interaction.client.users.fetch(req.requester_id).catch(() => null);
  if (requester) requester.send({ embeds: [Embed.success('Rank Request Accepted', `Your rank request (#${id}) has been accepted!\nUser ranked to **${req.requested_rank_name}**.`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('Rank Applied', `Request #${id} accepted. User ranked to **${req.requested_rank_name}**.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

async function handleRankDeny(interaction, requestId) {
  await interaction.deferReply({ ephemeral: true });

  // Authorization: ManageGuild required for both slash and button paths.
  if (!isAuthorizedReviewer(interaction)) {
    return interaction.editReply({ embeds: [Embed.error('Unauthorized', 'You need the **Manage Server** permission to deny rank requests.')] });
  }

  const id = requestId || interaction.options?.getInteger('requestid');
  const req = db.prepare('SELECT * FROM rank_requests WHERE id = ?').get(id);
  if (!req) return interaction.editReply({ embeds: [Embed.error('Not Found', `Request #${id} not found.`)] });

  // Guild isolation: the request must belong to the server where this
  // interaction originates, preventing cross-guild ID-guessing attacks.
  if (req.guild_id !== interaction.guildId) {
    return interaction.editReply({ embeds: [Embed.error('Wrong Server', 'This rank request belongs to a different server.')] });
  }

  if (req.status !== 'pending') return interaction.editReply({ embeds: [Embed.error('Already Handled', 'This request has already been processed.')] });
  db.prepare("UPDATE rank_requests SET status = 'denied', reviewed_by = ? WHERE id = ?").run(interaction.user.id, id);
  const requester = await interaction.client.users.fetch(req.requester_id).catch(() => null);
  if (requester) requester.send({ embeds: [Embed.error('Rank Request Denied', `Your rank request (#${id}) was denied.`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('Request Denied', `Rank request #${id} denied.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder().setName('acceptrank').setDescription('Accept a rank request')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('requestid').setDescription('Request ID').setRequired(true)),
  async execute(interaction) { return handleRankAccept(interaction, interaction.options.getInteger('requestid')); },
  handleRankAccept, handleRankDeny,
};
