const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const Embed = require('../../utils/embed');
const Roblox = require('../../utils/roblox');
const { getSetting, setSetting } = require('../../database');

// ── helpers ────────────────────────────────────────────────────────────────

function resolveGroupId(interaction) {
  return interaction.options.getString('groupid') || getSetting(interaction.guildId, 'roblox_group_id');
}

function groupEmbed(group, thumbnail, extraFields = []) {
  const embed = new EmbedBuilder()
    .setColor(0xFF3333)
    .setTitle(`🟥  ${group.name}`)
    .setDescription(group.description?.slice(0, 500) || '*No description.*')
    .setThumbnail(thumbnail || null)
    .addFields(
      { name: '👑 Owner', value: group.owner?.username || 'None', inline: true },
      { name: '👥 Members', value: Number(group.memberCount).toLocaleString(), inline: true },
      { name: '🆔 Group ID', value: String(group.id), inline: true },
      ...extraFields,
    )
    .setFooter({ text: 'Roblox Group • Loopy Bot' })
    .setTimestamp();
  return embed;
}

function joinRow(groupId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Open on Roblox')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.roblox.com/groups/${groupId}`)
      .setEmoji('🟥'),
    new ButtonBuilder()
      .setLabel('Join Group')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.roblox.com/groups/${groupId}#!/about`)
      .setEmoji('➕'),
  );
}

// ── command ────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('group')
    .setDescription('Manage and view your Roblox group')

    // /group set <id>
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Link a Roblox group to this server (admin only)')
        .addStringOption(o =>
          o.setName('groupid')
            .setDescription('Roblox group ID')
            .setRequired(true)
        )
    )

    // /group info [id]
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View info about the linked group (or any group)')
        .addStringOption(o =>
          o.setName('groupid')
            .setDescription('Group ID — leave blank to use the server group')
            .setRequired(false)
        )
    )

    // /group roles [id]
    .addSubcommand(sub =>
      sub.setName('roles')
        .setDescription('List all ranks in the linked group')
        .addStringOption(o =>
          o.setName('groupid')
            .setDescription('Group ID — leave blank to use the server group')
            .setRequired(false)
        )
    )

    // /group join [id]
    .addSubcommand(sub =>
      sub.setName('join')
        .setDescription('Get the join link for the linked group')
        .addStringOption(o =>
          o.setName('groupid')
            .setDescription('Group ID — leave blank to use the server group')
            .setRequired(false)
        )
    )

    // /group botjoin <id>
    .addSubcommand(sub =>
      sub.setName('botjoin')
        .setDescription("Make Loopy's Roblox account join a group (requires ROBLOX_COOKIE secret)")
        .addStringOption(o =>
          o.setName('groupid')
            .setDescription('Roblox group ID to join')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ── /group set ──────────────────────────────────────────────────────────
    if (sub === 'set') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [Embed.error('Permission Denied', 'You need **Manage Server** permission to link a group.')],
          ephemeral: true,
        });
      }
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.options.getString('groupid').trim();
      if (!/^\d+$/.test(groupId)) {
        return interaction.editReply({ embeds: [Embed.error('Invalid ID', 'Group IDs are numbers only — e.g. `12345678`.')] });
      }

      const [group, thumbnail] = await Promise.all([
        Roblox.getGroupInfo(groupId),
        Roblox.getGroupThumbnail(groupId),
      ]);
      if (!group) {
        return interaction.editReply({ embeds: [Embed.error('Not Found', `No Roblox group found with ID \`${groupId}\`.\nDouble-check the ID from the group's URL.`)] });
      }

      setSetting(interaction.guildId, 'roblox_group_id', groupId);

      const embed = groupEmbed(group, thumbnail, [
        { name: '✅ Status', value: 'Linked to this server', inline: true },
      ]);
      embed.setTitle(`✅  Group Linked — ${group.name}`);
      return interaction.editReply({ embeds: [embed], components: [joinRow(groupId)] });
    }

    // ── /group info ─────────────────────────────────────────────────────────
    if (sub === 'info') {
      await interaction.deferReply();
      const groupId = resolveGroupId(interaction);
      if (!groupId) {
        return interaction.editReply({ embeds: [Embed.error('No Group Linked', 'No group set for this server. Use `/group set <id>` first.')] });
      }

      const [group, thumbnail] = await Promise.all([
        Roblox.getGroupInfo(groupId),
        Roblox.getGroupThumbnail(groupId),
      ]);
      if (!group) {
        return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find group \`${groupId}\`.`)] });
      }

      const serverGroup = getSetting(interaction.guildId, 'roblox_group_id');
      const isLinked = String(serverGroup) === String(groupId);
      const embed = groupEmbed(group, thumbnail, [
        { name: '🔗 Server Link', value: isLinked ? '✅ Primary group' : '—', inline: true },
        { name: '🌐 URL', value: `[Open Group](https://www.roblox.com/groups/${groupId})`, inline: true },
      ]);
      return interaction.editReply({ embeds: [embed], components: [joinRow(groupId)] });
    }

    // ── /group roles ────────────────────────────────────────────────────────
    if (sub === 'roles') {
      await interaction.deferReply();
      const groupId = resolveGroupId(interaction);
      if (!groupId) {
        return interaction.editReply({ embeds: [Embed.error('No Group Linked', 'No group set for this server. Use `/group set <id>` first.')] });
      }

      const [roles, group] = await Promise.all([
        Roblox.getGroupRoles(groupId),
        Roblox.getGroupInfo(groupId),
      ]);
      if (!roles.length) {
        return interaction.editReply({ embeds: [Embed.error('Error', `Could not fetch roles for group \`${groupId}\`.`)] });
      }

      const sorted = roles.sort((a, b) => b.rank - a.rank);
      const lines = sorted.map(r =>
        `\`[${String(r.rank).padStart(3, '0')}]\` **${r.name}**${r.memberCount != null ? `  —  ${Number(r.memberCount).toLocaleString()} member${r.memberCount !== 1 ? 's' : ''}` : ''}`
      );

      // Split into chunks if long
      const chunks = [];
      let current = '';
      for (const line of lines) {
        if ((current + '\n' + line).length > 1024) { chunks.push(current); current = line; }
        else current = current ? current + '\n' + line : line;
      }
      if (current) chunks.push(current);

      const embed = new EmbedBuilder()
        .setColor(0xFF3333)
        .setTitle(`🟥  ${group?.name || 'Group'} — Roles (${roles.length})`)
        .setFooter({ text: `Group ID: ${groupId}` })
        .setTimestamp();

      chunks.slice(0, 5).forEach((chunk, i) =>
        embed.addFields({ name: i === 0 ? 'Ranks (highest → lowest)' : '\u200b', value: chunk })
      );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── /group join ─────────────────────────────────────────────────────────
    if (sub === 'join') {
      await interaction.deferReply();
      const groupId = resolveGroupId(interaction);
      if (!groupId) {
        return interaction.editReply({ embeds: [Embed.error('No Group Linked', 'No group set for this server. Use `/group set <id>` first.')] });
      }

      const [group, thumbnail] = await Promise.all([
        Roblox.getGroupInfo(groupId),
        Roblox.getGroupThumbnail(groupId),
      ]);

      const embed = new EmbedBuilder()
        .setColor(0xFF3333)
        .setTitle(`🟥  Join ${group?.name || 'the Group'}`)
        .setDescription(
          group?.publicEntryAllowed === false
            ? '⚠️ This group requires an **invitation** or **manual approval** to join.\nClick the button below and request to join on Roblox.'
            : '✅ This group is **open** — click the button below to join on Roblox!'
        )
        .setThumbnail(thumbnail || null)
        .addFields(
          { name: '👥 Members', value: Number(group?.memberCount ?? 0).toLocaleString(), inline: true },
          { name: '🆔 Group ID', value: String(groupId), inline: true },
        )
        .setFooter({ text: 'You must be logged in to Roblox to join.' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [joinRow(groupId)] });
    }

    // ── /group botjoin ──────────────────────────────────────────────────────
    if (sub === 'botjoin') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          embeds: [Embed.error('Permission Denied', 'Only **Manage Server** members can use this.')],
          ephemeral: true,
        });
      }
      await interaction.deferReply({ ephemeral: true });
      const groupId = interaction.options.getString('groupid').trim();

      if (!/^\d+$/.test(groupId)) {
        return interaction.editReply({ embeds: [Embed.error('Invalid ID', 'Group IDs are numbers only — e.g. `12345678`.')] });
      }

      // If cookie not set, show setup instructions
      if (!process.env.ROBLOX_COOKIE) {
        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('⚠️  Setup Required — ROBLOX_COOKIE')
          .setDescription(
            'To make Loopy\'s Roblox account join groups, you need to provide its session cookie.\n\n' +
            '**Steps to get the cookie:**\n' +
            '1. Log into the **bot\'s Roblox account** in a browser\n' +
            '2. Open DevTools → **Application** tab → **Cookies** → `www.roblox.com`\n' +
            '3. Find the cookie named **`.ROBLOSECURITY`** and copy its value\n' +
            '4. In this Replit project, open **Secrets** and add:\n' +
            '   - Key: `ROBLOX_COOKIE`\n' +
            '   - Value: the copied cookie value\n' +
            '5. Restart the bot, then run `/group botjoin` again\n\n' +
            '> ⚠️ Keep this secret safe — it gives full access to that Roblox account.'
          )
          .setFooter({ text: 'Roblox session cookies expire when the account logs out.' })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      // Fetch group info first so we can show a nice result
      const [group, thumbnail, result] = await Promise.all([
        Roblox.getGroupInfo(groupId),
        Roblox.getGroupThumbnail(groupId),
        Roblox.joinGroup(groupId),
      ]);

      if (!result.success) {
        if (result.needsCookie) {
          return interaction.editReply({ embeds: [Embed.error('Cookie Not Set', result.error)] });
        }
        // Handle "already a member" gracefully
        const alreadyMember = result.error?.toLowerCase().includes('already');
        if (alreadyMember) {
          const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅  Already a Member')
            .setDescription(`Loopy's Roblox account is **already in ${group?.name || `group ${groupId}`}**.`)
            .setThumbnail(thumbnail || null)
            .setTimestamp();
          return interaction.editReply({ embeds: [embed] });
        }
        return interaction.editReply({ embeds: [Embed.error('Could Not Join', result.error)] });
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle(`✅  Joined ${group?.name || `Group ${groupId}`}`)
        .setDescription(`Loopy's Roblox account has successfully joined the group!`)
        .setThumbnail(thumbnail || null)
        .addFields(
          { name: '🆔 Group ID', value: String(groupId), inline: true },
          { name: '👥 Members', value: Number(group?.memberCount ?? 0).toLocaleString(), inline: true },
          { name: '👑 Owner', value: group?.owner?.username || 'Unknown', inline: true },
        )
        .setFooter({ text: 'Roblox Group • Loopy Bot' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], components: [joinRow(groupId)] });
    }
  },
};
