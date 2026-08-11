const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

async function handleLoaDeny(interaction, loaId) {
  await interaction.deferReply({ ephemeral: true });
  const id = loaId || interaction.options?.getInteger('id');
  const loa = db.prepare('SELECT * FROM loa_requests WHERE id = ?').get(id);
  if (!loa) return interaction.editReply({ embeds: [Embed.error('Not Found', `LOA request #${id} not found.`)] });
  db.prepare("UPDATE loa_requests SET status = 'denied', reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(interaction.user.id, Math.floor(Date.now()/1000), id);
  const target = await interaction.client.users.fetch(loa.user_id).catch(() => null);
  if (target) target.send({ embeds: [Embed.error('LOA Denied', `Your LOA request in **${interaction.guild.name}** has been **denied**. Please contact a staff member if you have questions.`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('LOA Denied', `LOA #${id} denied.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder().setName('denyloa').setDescription('Deny an LOA request')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('id').setDescription('LOA ID').setRequired(true)),
  async execute(interaction) { return handleLoaDeny(interaction, interaction.options.getInteger('id')); },
  handleLoaDeny,
};
