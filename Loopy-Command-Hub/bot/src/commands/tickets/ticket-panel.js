const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits: PF } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const config = require('../../config');

function autoHelperRoles(guild) {
  const names = /support|helper|staff|moderator|admin/i;
  return guild.roles.cache
    .filter(role => !role.managed && role.id !== guild.id && names.test(role.name))
    .sort((a, b) => b.position - a.position)
    .first(5)
    .map(role => role.id);
}

module.exports = {
  data: new SlashCommandBuilder().setName('ticketpanel').setDescription('Create a ticket panel in a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post panel in').setRequired(true).addChannelTypes(ChannelType.GuildText))
    .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(false))
    .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const ch = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title') || '🎫 Support Tickets';
    const desc = interaction.options.getString('description') || 'Need help? Click below to open a ticket and our team will assist you as soon as possible.';
    const gid = interaction.guildId;
    const cats = db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ?').all(gid);
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle(title).setDescription(desc)
      .setFooter({ text: interaction.guild.name }).setTimestamp();
    let components = [];
    if (cats.length === 0) {
      components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open:general').setLabel('Open Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'))];
    } else if (cats.length === 1) {
      components = [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_open:${cats[0].name}`).setLabel(cats[0].label).setStyle(ButtonStyle.Primary).setEmoji(cats[0].emoji))];
    } else {
      const menu = new StringSelectMenuBuilder().setCustomId('ticket_category').setPlaceholder('Select a ticket category...')
        .addOptions(cats.map(c => ({ label: c.label, value: c.name, emoji: c.emoji, description: c.description || undefined })));
      components = [new ActionRowBuilder().addComponents(menu)];
    }
    await ch.send({ embeds: [embed], components });
    await interaction.editReply({ embeds: [Embed.success('Panel Created', `Ticket panel posted in ${ch}!`)] });
  },
};

async function handleTicketOpen(interaction, categoryName) {
  await interaction.deferReply({ ephemeral: true });
  const gid = interaction.guild.id;
  const cat = categoryName !== 'general' ? db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ? AND name = ?').get(gid, categoryName) : null;
  const maxOpen = cat?.max_open || 1;
  const openCount = db.prepare("SELECT COUNT(*) as c FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(gid, interaction.user.id).c;
  if (openCount >= maxOpen) return interaction.editReply({ embeds: [Embed.error('Ticket Limit', `You already have ${openCount} open ticket(s). Please close existing ones first.`)] });

  const ticketCount = db.prepare('SELECT COUNT(*) as c FROM tickets WHERE guild_id = ?').get(gid).c + 1;
  const channelName = `ticket-${interaction.user.username.slice(0,10).toLowerCase().replace(/[^a-z0-9]/g, '')}-${String(ticketCount).padStart(4, '0')}`;
   let supportRoles = [];
   try { supportRoles = cat ? JSON.parse(cat.support_role_ids || '[]') : []; } catch {}
   if (!supportRoles.length) supportRoles = autoHelperRoles(interaction.guild);

  const permOverwrites = [
    { id: interaction.guild.id, deny: ['ViewChannel'] },
    { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
     { id: interaction.client.user.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels', 'ReadMessageHistory', 'ManageMessages'] },
    ...supportRoles.map(rid => ({ id: rid, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles', 'ManageMessages'] })),
  ];

  const channel = await interaction.guild.channels.create({
    name: channelName, type: ChannelType.GuildText,
    permissionOverwrites: permOverwrites,
    reason: `Ticket opened by ${interaction.user.tag}`,
  });

  db.prepare('INSERT INTO tickets (guild_id, user_id, channel_id, category, status) VALUES (?, ?, ?, ?, ?)').run(gid, interaction.user.id, channel.id, categoryName, 'open');

  const ticketEmbed = new EmbedBuilder().setColor(config.colors.primary)
    .setTitle(`${cat?.emoji || '🎫'} ${cat?.label || 'Support Ticket'} #${ticketCount}`)
    .setDescription(`Hello ${interaction.user}! A support member will be with you shortly.\n\n${cat?.description ? `**Category:** ${cat.description}\n\n` : ''}Please describe your issue in detail.`)
    .addFields({ name: '📋 Ticket Info', value: `**Opened by:** ${interaction.user.tag}\n**Category:** ${cat?.label || 'General'}\n**Created:** <t:${Math.floor(Date.now()/1000)}:F>` })
    .setFooter({ text: 'Click "Close Ticket" when your issue is resolved' }).setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Secondary).setEmoji('📌'),
  );
  await channel.send({ content: `${interaction.user} ${supportRoles.map(r => `<@&${r}>`).join(' ')}`, embeds: [ticketEmbed], components: [row] });

  const logChId = cat?.log_channel_id || getSetting(gid, 'ticket_log_channel');
  if (logChId) { const lc = interaction.guild.channels.cache.get(logChId); if (lc) lc.send({ embeds: [Embed.info('Ticket Opened', `**User:** ${interaction.user.tag}\n**Category:** ${cat?.label || 'General'}\n**Channel:** ${channel}`)] }); }

  await interaction.editReply({ embeds: [Embed.success('Ticket Created', `Your ticket has been created! ${channel}`)] });
}

async function handleCategorySelect(interaction) {
  const category = interaction.values[0];
  return handleTicketOpen(interaction, category);
}

async function handleTicketModal(interaction, categoryName = 'general') {
  return handleTicketOpen(interaction, categoryName);
}

module.exports.handleTicketOpen = handleTicketOpen;
module.exports.handleCategorySelect = handleCategorySelect;
module.exports.handleTicketModal = handleTicketModal;
