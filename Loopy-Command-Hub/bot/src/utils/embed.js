const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * ─────────────────────────────────────────────────────────────
 *  Loopy Embed Design System
 *  - Rich, modern color palette (config.colors)
 *  - Branded author line + consistent footers
 *  - Formatting helpers: bar(), divider, field()
 * ─────────────────────────────────────────────────────────────
 */

const FOOTER_ICON = null; // set at runtime via setClient()
let botAvatarUrl = null;
let botName = 'Loopy';

/** Call once at startup so embeds can brand themselves with the bot avatar. */
const setClient = (client) => {
  try {
    botAvatarUrl = client.user.displayAvatarURL({ size: 64 });
    botName = client.user.username || 'Loopy';
  } catch { /* ignore */ }
};

/** Standard branded footer. Pass extra text to append after the bullet. */
const brandFooter = (extra) => ({
  text: extra ? `${botName} • ${extra}` : botName,
  iconURL: botAvatarUrl || FOOTER_ICON || undefined,
});

/** Thin decorative divider for descriptions. */
const divider = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

/** Progress / stat bar, e.g. bar(30, 100) → filled block bar. */
const bar = (value, max = 100, size = 10) => {
  const filled = Math.round((Math.max(0, Math.min(value, max)) / max) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
};

/** Inline field shorthand. */
const field = (name, value, inline = true) => ({ name, value: String(value), inline });

/** Core builder all helpers share. */
const base = ({ color, emoji, title, description, fields = [], thumbnail, footer, timestamp = true }) => {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(emoji ? `${emoji}  ${title}` : title);
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  if (thumbnail) e.setThumbnail(thumbnail);
  e.setFooter(brandFooter(footer));
  if (timestamp) e.setTimestamp();
  return e;
};

/** Success embed (green) */
const success = (title, description, fields = []) =>
  base({ color: config.colors.success, emoji: config.emojis.success, title, description, fields });

/** Error embed (red) — no timestamp noise, short and clear */
const error = (title, description) =>
  base({ color: config.colors.error, emoji: config.emojis.error, title, description, footer: 'Something went wrong' });

/** Warning embed (amber) */
const warning = (title, description) =>
  base({ color: config.colors.warning, emoji: config.emojis.warning, title, description });

/** Info embed (blurple) */
const info = (title, description, fields = []) =>
  base({ color: config.colors.info, emoji: config.emojis.info, title, description, fields });

/** Primary branded embed (no emoji prefix) */
const primary = (title, description, fields = []) =>
  base({ color: config.colors.primary, title, description, fields });

/** Ticket embed */
const ticket = (title, description, fields = []) =>
  base({ color: config.colors.ticket, emoji: config.emojis.ticket, title, description, fields, footer: 'Ticket System' });

/** Moderation embed (crimson, target avatar) */
const moderation = (action, target, moderator, reason, extra = []) =>
  base({
    color: config.colors.moderation,
    emoji: '🔨',
    title: `${action}`,
    description: `> **Target:** <@${target.id}> \`${target.tag}\`\n> **Moderator:** <@${moderator.id}>\n> **Reason:** ${reason || '*No reason provided*'}`,
    fields: extra,
    thumbnail: target.displayAvatarURL({ dynamic: true }),
    footer: `User ID: ${target.id}`,
  });

/** Level-up embed (gold, celebratory) */
const levelUp = (user, level) =>
  base({
    color: config.colors.gold,
    emoji: '🎉',
    title: 'Level Up!',
    description: `${divider}\n**${user.username ?? user}** just hit **Level ${level}**!\n${divider}`,
    thumbnail: user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null,
    footer: 'Keep chatting to earn XP',
  });

/** Music embed (violet) */
const music = (title, description, thumbnail = null, fields = []) =>
  base({ color: config.colors.music, emoji: config.emojis.music, title, description, fields, thumbnail, footer: 'Music Player' });

/** Roblox embed (signature red) */
const roblox = (title, description, fields = [], thumbnail = null) =>
  base({ color: config.colors.roblox, emoji: config.emojis.roblox, title, description, fields, thumbnail, footer: 'Roblox Integration' });

/** Application embed */
const application = (title, description, fields = [], color = config.colors.primary) =>
  base({ color, emoji: '📋', title, description, fields, footer: 'Applications' });

/** Leaderboard embed (gold) */
const leaderboard = (title, description, entries) =>
  base({ color: config.colors.gold, emoji: '🏆', title, description, fields: entries });

/** Game embed */
const game = (title, description, fields = [], color = config.colors.game) =>
  base({ color, emoji: config.emojis.game, title, description, fields });

/** Help embed */
const help = (category, commands) =>
  base({
    color: config.colors.primary,
    emoji: '📚',
    title: `Help — ${category}`,
    description: commands.map(c => `\`/${c.name}\` — ${c.description}`).join('\n'),
    footer: 'Use /help [command] for details',
  });

module.exports = {
  success, error, warning, info, primary, ticket, moderation, levelUp,
  music, roblox, application, leaderboard, game, help,
  // design-system utilities
  base, setClient, brandFooter, divider, bar, field,
};
