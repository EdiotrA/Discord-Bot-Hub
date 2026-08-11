const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('rankbinds').setDescription('View rank binds for this server')
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (default: server group)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const groupId = interaction.options.getString('groupid') || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.editReply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup` first.')] });
    const binds = db.prepare('SELECT * FROM rankbinds WHERE guild_id = ? AND roblox_group_id = ? ORDER BY roblox_rank_id').all(interaction.guildId, groupId);
    if (!binds.length) return interaction.editReply({ embeds: [Embed.info('Rank Binds', `No rank binds for group \`${groupId}\`. Use \`/addrankbind\` to add some.`)] });
    const desc = binds.map(b => `**${b.roblox_rank_name}** (Rank ${b.roblox_rank_id}) → <@&${b.discord_role_id}>`).join('\n');
    await interaction.editReply({ embeds: [Embed.roblox(`Rank Binds — Group ${groupId}`, desc)] });
  },
};
