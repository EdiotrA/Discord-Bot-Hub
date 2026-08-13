const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

function entryCount(messageId) {
  return db.prepare('SELECT COUNT(*) AS n FROM giveaway_entries WHERE message_id = ?').get(messageId).n;
}

function buildGiveawayEmbed(giveaway, { final = false } = {}) {
  const entries = entryCount(giveaway.message_id);
  const embed = new EmbedBuilder()
    .setColor(final ? config.colors.gold : config.colors.primary)
    .setTitle(`🎉  ${giveaway.prize}`)
    .setFooter(Embed.brandFooter('Giveaways'))
    .setTimestamp();
  const lines = [];
  if (giveaway.description) lines.push(giveaway.description, '');
  if (final) {
    const winners = JSON.parse(giveaway.winner_ids || '[]');
    lines.push(Embed.divider);
    lines.push(winners.length ? `> 🏆 **Winner${winners.length === 1 ? '' : 's'}:** ${winners.map(id => `<@${id}>`).join(', ')}` : '> **No valid entries — no winner could be drawn.**');
    lines.push(Embed.divider);
    lines.push('', `> **Hosted by:** <@${giveaway.host_id}>\n> **Entries:** \`${entries}\``);
  } else {
    lines.push(`> ⏰ **Ends:** <t:${giveaway.ends_at}:R> (<t:${giveaway.ends_at}:f>)`);
    lines.push(`> 🏆 **Winners:** \`${giveaway.winner_count}\``);
    lines.push(`> 👤 **Hosted by:** <@${giveaway.host_id}>`);
    if (giveaway.required_role_id) lines.push(`> 🔑 **Requirement:** <@&${giveaway.required_role_id}>`);
    lines.push('', `> **${entries}** ${entries === 1 ? 'person has' : 'people have'} entered — click below to join!`);
  }
  embed.setDescription(lines.join('\n'));
  return embed;
}

function buildGiveawayButtons(giveaway, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gw_enter').setLabel('Enter Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId('gw_entries').setLabel('My Entry').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  )];
}

function drawWinners(messageId, count, excluded = []) {
  const entries = db.prepare('SELECT user_id FROM giveaway_entries WHERE message_id = ?').all(messageId)
    .map(row => row.user_id)
    .filter(id => !excluded.includes(id));
  const winners = [];
  while (entries.length && winners.length < count) {
    const index = Math.floor(Math.random() * entries.length);
    winners.push(entries.splice(index, 1)[0]);
  }
  return winners;
}

async function endGiveaway(client, messageId, { reroll = false } = {}) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
  if (!giveaway || (giveaway.ended && !reroll)) return null;
  // Exclude everyone who has ever won this giveaway across all rerolls.
  const previous = reroll
    ? [...new Set([...JSON.parse(giveaway.past_winner_ids || '[]'), ...JSON.parse(giveaway.winner_ids || '[]')])]
    : [];
  const winners = drawWinners(messageId, giveaway.winner_count, previous);
  db.prepare('UPDATE giveaways SET ended = 1, winner_ids = ?, past_winner_ids = ? WHERE message_id = ?')
    .run(JSON.stringify(winners), JSON.stringify(previous), messageId);
  giveaway.ended = 1;
  giveaway.winner_ids = JSON.stringify(winners);
  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    const message = await channel.messages.fetch(giveaway.message_id);
    await message.edit({ embeds: [buildGiveawayEmbed(giveaway, { final: true })], components: buildGiveawayButtons(giveaway, true) });
    if (winners.length) {
      await channel.send({ content: winners.map(id => `<@${id}>`).join(' '), embeds: [Embed.success(reroll ? 'Giveaway Rerolled' : 'Giveaway Ended', `Congratulations! You won **${giveaway.prize}** 🎉\nHosted by <@${giveaway.host_id}>.`)] });
    } else {
      await channel.send({ embeds: [Embed.warning('Giveaway Ended', `No valid entries for **${giveaway.prize}** — no winner drawn.`)] });
    }
  } catch (error) {
    console.error('[Giveaway] Failed to finalize giveaway:', error.message);
  }
  return winners;
}

const MAX_TIMEOUT = 2 ** 31 - 1;

function scheduleGiveaway(client, giveaway) {
  const delay = Math.max(0, giveaway.ends_at * 1000 - Date.now());
  if (delay > MAX_TIMEOUT) {
    // setTimeout overflows past ~24.8 days; chain timers until in range.
    setTimeout(() => scheduleGiveaway(client, giveaway), MAX_TIMEOUT);
  } else {
    setTimeout(() => endGiveaway(client, giveaway.message_id), delay);
  }
}

async function handleGiveawayButton(interaction, action) {
  const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(interaction.message.id);
  if (!giveaway) return interaction.reply({ content: 'This giveaway no longer exists.', ephemeral: true });
  if (giveaway.ended || giveaway.ends_at * 1000 <= Date.now()) {
    return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  }
  const entered = db.prepare('SELECT 1 FROM giveaway_entries WHERE message_id = ? AND user_id = ?').get(giveaway.message_id, interaction.user.id);
  if (action === 'gw_entries') {
    return interaction.reply({ content: entered ? '✅ You are entered in this giveaway. Good luck!' : 'You have not entered this giveaway yet.', ephemeral: true });
  }
  if (giveaway.required_role_id && !interaction.member.roles.cache.has(giveaway.required_role_id)) {
    return interaction.reply({ content: `You need the <@&${giveaway.required_role_id}> role to enter this giveaway.`, ephemeral: true });
  }
  if (entered) {
    db.prepare('DELETE FROM giveaway_entries WHERE message_id = ? AND user_id = ?').run(giveaway.message_id, interaction.user.id);
    await interaction.update({ embeds: [buildGiveawayEmbed(giveaway)], components: buildGiveawayButtons(giveaway) }).catch(() => {});
    return interaction.followUp({ content: 'Your entry was withdrawn.', ephemeral: true }).catch(() => {});
  }
  db.prepare('INSERT INTO giveaway_entries (message_id, user_id) VALUES (?, ?)').run(giveaway.message_id, interaction.user.id);
  await interaction.update({ embeds: [buildGiveawayEmbed(giveaway)], components: buildGiveawayButtons(giveaway) }).catch(() => {});
  return interaction.followUp({ content: `🎉 You entered the giveaway for **${giveaway.prize}**. Good luck!`, ephemeral: true }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder().setName('giveaway').setDescription('Host giveaways with a click-to-enter button')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('start').setDescription('Start a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('What is being given away').setRequired(true).setMaxLength(200))
      .addIntegerOption(o => o.setName('minutes').setDescription('How long the giveaway runs (minutes)').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners (default 1)').setRequired(false).setMinValue(1).setMaxValue(20))
      .addStringOption(o => o.setName('description').setDescription('Extra details shown in the embed').setRequired(false).setMaxLength(500))
      .addRoleOption(o => o.setName('requiredrole').setDescription('Role required to enter').setRequired(false)))
    .addSubcommand(s => s.setName('end').setDescription('End a giveaway early and draw winners')
      .addStringOption(o => o.setName('messageid').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll winners for an ended giveaway')
      .addStringOption(o => o.setName('messageid').setDescription('Giveaway message ID').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active giveaways in this server')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Runtime enforcement: the default-permission flag alone can be overridden
    // per-server, and the bot's own permission system treats fun commands as
    // public, so management subcommands must be checked explicitly.
    if (['start', 'end', 'reroll'].includes(sub) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ embeds: [Embed.error('Permission Denied', 'You need the **Manage Server** permission to manage giveaways.')], ephemeral: true });
    }

    if (sub === 'start') {
      const prize = interaction.options.getString('prize');
      const minutes = interaction.options.getInteger('minutes');
      const winnerCount = interaction.options.getInteger('winners') || 1;
      const description = interaction.options.getString('description') || '';
      const requiredRole = interaction.options.getRole('requiredrole');
      const endsAt = Math.floor(Date.now() / 1000) + minutes * 60;

      await interaction.deferReply();
      const message = await interaction.fetchReply();
      const giveaway = {
        message_id: message.id,
        guild_id: interaction.guildId,
        channel_id: interaction.channelId,
        host_id: interaction.user.id,
        prize,
        description,
        winner_count: winnerCount,
        required_role_id: requiredRole?.id || null,
        ends_at: endsAt,
        ended: 0,
        winner_ids: '[]',
      };
      db.prepare('INSERT INTO giveaways (message_id, guild_id, channel_id, host_id, prize, description, winner_count, required_role_id, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(giveaway.message_id, giveaway.guild_id, giveaway.channel_id, giveaway.host_id, prize, description, winnerCount, giveaway.required_role_id, endsAt);
      await interaction.editReply({ embeds: [buildGiveawayEmbed(giveaway)], components: buildGiveawayButtons(giveaway) });
      return scheduleGiveaway(interaction.client, giveaway);
    }

    if (sub === 'end' || sub === 'reroll') {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.options.getString('messageid').trim();
      const giveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND guild_id = ?').get(messageId, interaction.guildId);
      if (!giveaway) return interaction.editReply({ embeds: [Embed.error('Not Found', 'No giveaway with that message ID exists in this server.')] });
      if (sub === 'end' && giveaway.ended) return interaction.editReply({ embeds: [Embed.warning('Already Ended', 'That giveaway already ended. Use `/giveaway reroll` to draw new winners.')] });
      if (sub === 'reroll' && !giveaway.ended) return interaction.editReply({ embeds: [Embed.warning('Still Running', 'That giveaway is still active. Use `/giveaway end` first.')] });
      const winners = await endGiveaway(interaction.client, messageId, { reroll: sub === 'reroll' });
      return interaction.editReply({ embeds: [Embed.success(sub === 'reroll' ? 'Rerolled' : 'Giveaway Ended', winners && winners.length ? `New winner${winners.length === 1 ? '' : 's'}: ${winners.map(id => `<@${id}>`).join(', ')}` : 'No valid entries to draw from.')] });
    }

    if (sub === 'list') {
      const rows = db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 ORDER BY ends_at ASC').all(interaction.guildId);
      if (!rows.length) return interaction.reply({ embeds: [Embed.info('Active Giveaways', 'No active giveaways. Start one with `/giveaway start`.')], ephemeral: true });
      const lines = rows.map(g => `🎉 **${g.prize}**\n> Ends <t:${g.ends_at}:R> • \`${entryCount(g.message_id)}\` entries • [Jump](https://discord.com/channels/${g.guild_id}/${g.channel_id}/${g.message_id})`);
      return interaction.reply({ embeds: [Embed.info('Active Giveaways', lines.join('\n'))], ephemeral: true });
    }
  },
  handleGiveawayButton,
  scheduleGiveaway,
  endGiveaway,
};
