const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder().setName('syncranks').setDescription('Sync Roblox rank to Discord roles')
    .addUserOption(o => o.setName('user').setDescription('User to sync (default: yourself)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user') || interaction.member;
    const gid = interaction.guildId;
    const groupId = getSetting(gid, 'roblox_group_id');
    if (!groupId) return interaction.editReply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup`.')] });
    const verification = db.prepare('SELECT roblox_user_id FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(gid, target.id);
    if (!verification) return interaction.editReply({ embeds: [Embed.error('Not Verified', `${target.user.tag} is not verified. Use \`/verify\` first.`)] });
    const rank = await Roblox.getUserGroupRank(verification.roblox_user_id, groupId);
    const binds = db.prepare('SELECT * FROM rankbinds WHERE guild_id = ? AND roblox_group_id = ?').all(gid, groupId);
    const allBindRoles = binds.map(b => b.discord_role_id);
    const matchingBind = binds.find(b => b.roblox_rank_id === rank?.rank);
    let added = [], removed = [];
    for (const roleId of allBindRoles) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;
      if (matchingBind && roleId === matchingBind.discord_role_id) { if (!target.roles.cache.has(roleId)) { await target.roles.add(role).catch(() => {}); added.push(role.name); } }
      else { if (target.roles.cache.has(roleId)) { await target.roles.remove(role).catch(() => {}); removed.push(role.name); } }
    }
    await interaction.editReply({ embeds: [Embed.success('Ranks Synced', `**Roblox Rank:** ${rank ? `${rank.name} (${rank.rank})` : 'Not in group'}\n**Added:** ${added.join(', ') || 'None'}\n**Removed:** ${removed.join(', ') || 'None'}`)] });
  },
};
