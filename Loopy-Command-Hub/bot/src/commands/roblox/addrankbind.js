const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');

// Cache per guild so we don't hammer Roblox on every keystroke
const rolesCache = new Map(); // key: groupId → { roles, at }
const CACHE_TTL = 60_000; // 1 minute

async function fetchRoles(groupId) {
  const cached = rolesCache.get(groupId);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.roles;
  try {
    const roles = await Roblox.getGroupRoles(groupId);
    rolesCache.set(groupId, { roles, at: Date.now() });
    return roles;
  } catch {
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addrankbind')
    .setDescription('Bind a Roblox rank to a Discord role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption(o => o.setName('role').setDescription('Discord role to assign').setRequired(true))
    .addStringOption(o => o
      .setName('rank')
      .setDescription('Roblox rank — start typing to search')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (defaults to server group)').setRequired(false)),

  async autocomplete(interaction) {
    const groupId = interaction.options.getString('groupid')
      || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.respond([{ name: 'Set a group with /setgroup first', value: '0' }]);

    const focused = interaction.options.getFocused().toLowerCase();
    const roles   = await fetchRoles(groupId);

    const choices = roles
      .filter(r => r.rank > 0) // exclude rank 0 (Guest)
      .filter(r => !focused || r.name.toLowerCase().includes(focused) || String(r.rank).includes(focused))
      .slice(0, 25)
      .map(r => ({ name: `${r.name} (Rank ${r.rank})`, value: `${r.rank}::${r.name}` }));

    return interaction.respond(choices);
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const groupId = interaction.options.getString('groupid')
      || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) {
      return interaction.editReply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup` first.')] });
    }

    const rankValue = interaction.options.getString('rank');
    const role      = interaction.options.getRole('role');

    // Value is "rankId::rankName" from autocomplete, or a raw integer if typed manually
    let rankId, rankName;
    if (rankValue.includes('::')) {
      [rankId, rankName] = rankValue.split('::');
      rankId = parseInt(rankId, 10);
    } else {
      rankId = parseInt(rankValue, 10);
      if (isNaN(rankId) || rankId < 1 || rankId > 255) {
        return interaction.editReply({ embeds: [Embed.error('Invalid Rank', 'Pick a rank from the list or enter a valid rank ID (1–255).')] });
      }
      // Look up name from cache if available
      const roles = await fetchRoles(groupId);
      const found = roles.find(r => r.rank === rankId);
      rankName = found?.name ?? `Rank ${rankId}`;
    }

    db.prepare(
      'INSERT OR REPLACE INTO rankbinds (guild_id, roblox_group_id, roblox_rank_id, roblox_rank_name, discord_role_id) VALUES (?, ?, ?, ?, ?)'
    ).run(interaction.guildId, groupId, rankId, rankName, role.id);

    await interaction.editReply({
      embeds: [Embed.success(
        'Rank Bind Added',
        `**${rankName}** (Rank ${rankId}) → ${role}`,
      )],
    });
  },
};
