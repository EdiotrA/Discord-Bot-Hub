const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');

async function handleRankAccept(interaction, requestId) {
  await interaction.deferReply({ ephemeral: true });
  const id = requestId || interaction.options?.getInteger('requestid');
  const req = db.prepare('SELECT * FROM rank_requests WHERE id = ?').get(id);
  if (!req) return interaction.editReply({ embeds: [Embed.error('Not Found', `Rank request #${id} not found.`)] });
  if (req.status !== 'pending') return interaction.editReply({ embeds: [Embed.error('Already Handled', 'This request has already been processed.')] });

  const myVerify = db.prepare('SELECT roblox_user_id FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(req.guild_id, interaction.user.id);
  if (myVerify) {
    const myRank = await Roblox.getUserGroupRank(myVerify.roblox_user_id, req.roblox_group_id);
    if (myRank && req.requested_rank_id >= myRank.rank) return interaction.editReply({ embeds: [Embed.error('Permission Denied', 'You cannot rank someone to a rank equal to or higher than yours.')] });
  }

  const result = await Roblox.setUserRank(req.roblox_group_id, req.target_user_id, req.requested_rank_id);
  if (!result.success) {
    return interaction.editReply({ embeds: [Embed.error('Rank Failed', `Could not set rank: ${result.error}\n\nMake sure the bot's Open Cloud API key has **Group: Write** permission.`)] });
  }
  db.prepare("UPDATE rank_requests SET status = 'accepted', reviewed_by = ? WHERE id = ?").run(interaction.user.id, id);
  const requester = await interaction.client.users.fetch(req.requester_id).catch(() => null);
  if (requester) requester.send({ embeds: [Embed.success('Rank Request Accepted', `Your rank request (#${id}) has been accepted!\nUser ranked to **${req.requested_rank_name}**.`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('Rank Applied', `Request #${id} accepted. User ranked to **${req.requested_rank_name}**.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

async function handleRankDeny(interaction, requestId) {
  await interaction.deferReply({ ephemeral: true });
  const id = requestId || interaction.options?.getInteger('requestid');
  const req = db.prepare('SELECT * FROM rank_requests WHERE id = ?').get(id);
  if (!req) return interaction.editReply({ embeds: [Embed.error('Not Found', `Request #${id} not found.`)] });
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
