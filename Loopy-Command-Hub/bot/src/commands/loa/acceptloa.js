const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

async function handleLoaAccept(interaction, loaId) {
  await interaction.deferReply({ ephemeral: true });
  const id = loaId || interaction.options?.getInteger('id');
  const loa = db.prepare('SELECT * FROM loa_requests WHERE id = ?').get(id);
  if (!loa) return interaction.editReply({ embeds: [Embed.error('Not Found', `LOA request #${id} not found.`)] });
  const reviewerRole = getSetting(loa.guild_id, 'loa_reviewer_role');
  if (reviewerRole && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.roles.cache.has(reviewerRole))
    return interaction.editReply({ embeds: [Embed.error('No Permission', 'You cannot accept LOA requests.')] });
  db.prepare("UPDATE loa_requests SET status = 'accepted', reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(interaction.user.id, Math.floor(Date.now()/1000), id);
  const target = await interaction.client.users.fetch(loa.user_id).catch(() => null);
  if (target) target.send({ embeds: [Embed.success('LOA Accepted! ✅', `Your LOA request in **${interaction.guild.name}** has been **accepted**.\n**From:** <t:${loa.start_date}:D> **To:** <t:${loa.end_date}:D>`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('LOA Accepted', `LOA #${id} accepted.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder().setName('acceptloa').setDescription('Accept an LOA request')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('id').setDescription('LOA ID').setRequired(true)),
  async execute(interaction) { return handleLoaAccept(interaction, interaction.options.getInteger('id')); },
  handleLoaAccept,
};
