const {
  SlashCommandBuilder,
  PermissionsBitField,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const Embed = require('../../utils/embed');

// Full permission set Loopy needs to operate properly
const LOOPY_PERMISSIONS = PermissionsBitField.resolve([
  'ViewChannel',
  'SendMessages',
  'SendMessagesInThreads',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'AddReactions',
  'UseExternalEmojis',
  'ManageMessages',
  'ManageChannels',
  'ManageRoles',
  'ManageNicknames',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
  'Connect',
  'Speak',
  'UseVAD',
  'MoveMembers',
  'CreateInstantInvite',
]);

function buildInviteUrl(clientId, guildId = null) {
  const base = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=${LOOPY_PERMISSIONS}`;
  return guildId ? `${base}&guild_id=${guildId}` : base;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Generate a Loopy invite link — generic or targeted at a specific server')
    .addStringOption(o =>
      o.setName('serverid')
        .setDescription('Discord server ID to pre-fill — the admin of that server must still approve')
        .setRequired(false)
    ),

  async execute(interaction) {
    const serverId = interaction.options.getString('serverid')?.trim();
    const clientId = interaction.client.application.id;

    // Targeted invite requires ManageGuild so random members can't abuse it
    if (serverId && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        embeds: [Embed.error('Permission Denied', 'Only members with **Manage Server** can generate a targeted invite.')],
        ephemeral: true,
      });
    }

    // Validate server ID if given
    if (serverId && !/^\d{17,20}$/.test(serverId)) {
      return interaction.reply({
        embeds: [Embed.error('Invalid Server ID', 'Discord server IDs are 17–20 digit numbers.\nRight-click a server icon → **Copy Server ID** (Developer Mode must be on).')],
        ephemeral: true,
      });
    }

    const inviteUrl = buildInviteUrl(clientId, serverId || null);
    const genericUrl = buildInviteUrl(clientId);

    let title, description;
    if (serverId) {
      title = '🔗 Targeted Invite Generated';
      description =
        `This link is pre-filled for server ID \`${serverId}\`.\n\n` +
        `**Share it with an admin of that server.** When they open it, Discord will skip the server picker and go straight to the approval screen for that server.\n\n` +
        `> ⚠️ The admin of that server **must still click Authorise** — Loopy cannot join without their approval.`;
    } else {
      title = '🔗 Add Loopy to a Server';
      description =
        `Click **Add to Server** to pick a server from your list.\n\n` +
        `To target a specific server, run \`/invite serverid:<id>\` — the bot picker will skip straight to that server's approval screen.\n\n` +
        `> Discord always shows the permission approval screen. Loopy cannot join without explicit admin approval.`;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: '📋 Permissions', value: 'Moderation, voice, channels, roles, messages', inline: true },
        { name: '🔑 Scope', value: '`bot` + `applications.commands`', inline: true },
      )
      .setFooter({ text: 'Loopy Bot • Invite System' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(serverId ? 'Open Targeted Invite' : 'Add Loopy to a Server')
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl)
        .setEmoji('➕'),
    );

    // If targeted, also show the generic link as a secondary button
    if (serverId) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Generic Invite')
          .setStyle(ButtonStyle.Link)
          .setURL(genericUrl)
          .setEmoji('🔗'),
      );
    }

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },
};
