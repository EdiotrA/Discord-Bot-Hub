const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removerankbind')
    .setDescription('Remove a rank bind')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o
      .setName('rank')
      .setDescription('Rank bind to remove')
      .setRequired(true)
      .setAutocomplete(true))
    .addStringOption(o => o.setName('groupid').setDescription('Group ID (defaults to server group)').setRequired(false)),

  async autocomplete(interaction) {
    const groupId = interaction.options.getString('groupid')
      || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) return interaction.respond([{ name: 'No group configured', value: '0' }]);

    const focused = interaction.options.getFocused().toLowerCase();
    const binds = db.prepare(
      'SELECT roblox_rank_id, roblox_rank_name FROM rankbinds WHERE guild_id = ? AND roblox_group_id = ? ORDER BY roblox_rank_id'
    ).all(interaction.guildId, groupId);

    const choices = binds
      .filter(b => !focused || b.roblox_rank_name.toLowerCase().includes(focused) || String(b.roblox_rank_id).includes(focused))
      .slice(0, 25)
      .map(b => ({ name: `${b.roblox_rank_name} (Rank ${b.roblox_rank_id})`, value: String(b.roblox_rank_id) }));

    if (!choices.length) return interaction.respond([{ name: 'No rank binds configured', value: '0' }]);
    return interaction.respond(choices);
  },

  async execute(interaction) {
    const groupId = interaction.options.getString('groupid')
      || getSetting(interaction.guildId, 'roblox_group_id');
    if (!groupId) {
      return interaction.reply({ embeds: [Embed.error('No Group', 'Set a group with `/setgroup` first.')], ephemeral: true });
    }

    const rankId = parseInt(interaction.options.getString('rank'), 10);
    if (!rankId) {
      return interaction.reply({ embeds: [Embed.error('Invalid Selection', 'Select a rank from the list.')], ephemeral: true });
    }

    const bind = db.prepare(
      'SELECT roblox_rank_name FROM rankbinds WHERE guild_id = ? AND roblox_group_id = ? AND roblox_rank_id = ?'
    ).get(interaction.guildId, groupId, rankId);

    db.prepare(
      'DELETE FROM rankbinds WHERE guild_id = ? AND roblox_group_id = ? AND roblox_rank_id = ?'
    ).run(interaction.guildId, groupId, rankId);

    const label = bind?.roblox_rank_name ?? `Rank ${rankId}`;
    await interaction.reply({
      embeds: [Embed.success('Rank Bind Removed', `**${label}** (Rank ${rankId}) has been unlinked.`)],
      ephemeral: true,
    });
  },
};
