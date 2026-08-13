const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('rank').setDescription('View all ranks in the Roblox group')
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (default: server group)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const groupId = interaction.options.getString('groupid') || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.editReply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup`.')] });
    const [roles, group] = await Promise.all([Roblox.getGroupRoles(groupId), Roblox.getGroupInfo(groupId)]);
    if (!roles.length) return interaction.editReply({ embeds: [Embed.error('Error', 'Could not fetch group roles.')] });

    // Check calling user's rank
    const verification = db.prepare('SELECT roblox_user_id FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(interaction.guildId, interaction.user.id);
    let myRank = null;
    if (verification) myRank = await Roblox.getUserGroupRank(verification.roblox_user_id, groupId);

    const rankList = roles.sort((a, b) => b.rank - a.rank).map(r => `\`[${String(r.rank).padStart(3, '0')}]\` **${r.name}**${myRank?.id === r.id ? '  ← *Your Rank*' : ''}`).join('\n');
    const embed = Embed.roblox(
      `${group?.name || 'Group'} — Ranks`,
      rankList.slice(0, 3000),
    );
    embed.setFooter(Embed.brandFooter(`Group ID: ${groupId} • ${roles.length} ranks total`));
    await interaction.editReply({ embeds: [embed] });
  },
};
