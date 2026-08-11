const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

async function handleAppAccept(interaction, appId) {
  await interaction.deferReply({ ephemeral: true });
  const id = appId || interaction.options?.getInteger('appid');
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!app) return interaction.editReply({ embeds: [Embed.error('Not Found', `Application #${id} not found.`)] });
  const appType = db.prepare('SELECT * FROM application_types WHERE guild_id = ? AND name = ?').get(app.guild_id, app.type);
  const reviewerRoles = JSON.parse(appType?.reviewer_role_ids || '[]');
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.roles.cache.some(r => reviewerRoles.includes(r.id)))
    return interaction.editReply({ embeds: [Embed.error('No Permission', 'You cannot accept this application.')] });
  db.prepare("UPDATE applications SET status = 'accepted', reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(interaction.user.id, Math.floor(Date.now()/1000), id);
  const target = await interaction.client.users.fetch(app.user_id).catch(() => null);
  if (target) target.send({ embeds: [Embed.success('Application Accepted! 🎉', `Your **${appType?.label || app.type}** application in **${interaction.guild.name}** has been **accepted**!\n\nWelcome aboard!`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('Application Accepted', `Application #${id} accepted. ${target?.tag || 'User'} has been notified.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

async function handleAppDeny(interaction, appId) {
  await interaction.deferReply({ ephemeral: true });
  const id = appId || interaction.options?.getInteger('appid');
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!app) return interaction.editReply({ embeds: [Embed.error('Not Found', `Application #${id} not found.`)] });
  db.prepare("UPDATE applications SET status = 'denied', reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(interaction.user.id, Math.floor(Date.now()/1000), id);
  const target = await interaction.client.users.fetch(app.user_id).catch(() => null);
  if (target) target.send({ embeds: [Embed.error('Application Denied', `Your application in **${interaction.guild.name}** has been **denied**. You may re-apply in the future.`)] }).catch(() => {});
  await interaction.editReply({ embeds: [Embed.success('Application Denied', `Application #${id} denied.`)] });
  if (interaction.message) await interaction.message.edit({ components: [] }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder().setName('accept').setDescription('Accept an application')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption(o => o.setName('appid').setDescription('Application ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) { return handleAppAccept(interaction, interaction.options.getInteger('appid')); },
  handleAppAccept,
};
module.exports.handleAppDeny = handleAppDeny;
