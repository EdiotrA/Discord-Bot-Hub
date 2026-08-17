const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * ─────────────────────────────────────────────────────────────
 *  Loopy Embed Design System — Professional Edition
 *  Identity comes from color + typography, not emoji prefixes.
 *  Each helper exposes clean, consistent embeds with branded
 *  footers and optional structured fields.
 * ─────────────────────────────────────────────────────────────
 */

let botAvatarUrl = null;
let botName = 'Loopy';

/** Call once at startup so embeds can brand themselves with the bot avatar. */
const setClient = (client) => {
  try {
    botAvatarUrl = client.user.displayAvatarURL({ size: 64 });
    botName = client.user.username || 'Loopy';
  } catch { /* ignore */ }
};

/** Standard branded footer. */
const brandFooter = (extra) => ({
  text: extra ? `${botName}  ·  ${extra}` : botName,
  iconURL: botAvatarUrl || undefined,
});

/** Thin decorative divider for descriptions. */
const divider = '──────────────────────';

/** Progress / stat bar, e.g. bar(30, 100) → filled block bar. */
const bar = (value, max = 100, size = 12) => {
  const filled = Math.round((Math.max(0, Math.min(value, max)) / max) * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
};

/** Inline field shorthand. */
const field = (name, value, inline = true) => ({ name, value: String(value), inline });

/**
 * Core builder — all helpers share this.
 * No emoji prefix is added to titles by default.
 */
const base = ({ color, title, description, fields = [], thumbnail, footer, timestamp = true, image = null, author = null }) => {
  const e = new EmbedBuilder().setColor(color);
  if (title) e.setTitle(title);
  if (description) e.setDescription(description);
  if (fields.length) e.addFields(fields);
  if (thumbnail) e.setThumbnail(thumbnail);
  if (image) e.setImage(image);
  if (author) e.setAuthor(author);
  e.setFooter(brandFooter(footer));
  if (timestamp) e.setTimestamp();
  return e;
};

// ─── Semantic helpers ─────────────────────────────────────────────────────────

/** Success (green) */
const success = (title, description, fields = []) =>
  base({ color: config.colors.success, title, description, fields });

/** Error (red) — short, no timestamp noise */
const error = (title, description) =>
  base({ color: config.colors.error, title, description, timestamp: false, footer: 'Something went wrong' });

/** Warning (amber) */
const warning = (title, description, fields = []) =>
  base({ color: config.colors.warning, title, description, fields });

/** Info (sky blue) */
const info = (title, description, fields = []) =>
  base({ color: config.colors.info, title, description, fields });

/** Primary brand (indigo) */
const primary = (title, description, fields = []) =>
  base({ color: config.colors.primary, title, description, fields });

/** Ticket embed */
const ticket = (title, description, fields = []) =>
  base({ color: config.colors.ticket, title, description, fields, footer: 'Ticket System' });

/** Moderation embed — structured target/mod/reason block */
const moderation = (action, target, moderator, reason, extra = []) =>
  base({
    color: config.colors.moderation,
    title: action,
    description: [
      `**Target**   ${target.tag ?? target.username ?? target} \`(${target.id})\``,
      `**Moderator**   <@${moderator.id}>`,
      `**Reason**   ${reason || 'No reason provided'}`,
    ].join('\n'),
    fields: extra,
    thumbnail: target.displayAvatarURL?.({ dynamic: true }),
    footer: `User ID: ${target.id}`,
  });

/** Level-up embed (gold) */
const levelUp = (user, level) =>
  base({
    color: config.colors.gold,
    title: 'Level Up',
    description: `**${user.username ?? user}** reached **Level ${level}**`,
    thumbnail: user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null,
    footer: 'Keep chatting to earn XP',
  });

/** Music embed (violet) */
const music = (title, description, thumbnail = null, fields = []) =>
  base({ color: config.colors.music, title, description, fields, thumbnail, footer: 'Music Player' });

/** Roblox embed (signature red) */
const roblox = (title, description, fields = [], thumbnail = null) =>
  base({ color: config.colors.roblox, title, description, fields, thumbnail, footer: 'Roblox Integration' });

/** Application embed */
const application = (title, description, fields = [], color = config.colors.primary) =>
  base({ color, title, description, fields, footer: 'Applications' });

/** Leaderboard embed (gold) */
const leaderboard = (title, description, entries = []) =>
  base({ color: config.colors.gold, title, description, fields: entries });

/** Game / Mog embed */
const game = (title, description, fields = [], color = config.colors.game) =>
  base({ color, title, description, fields });

/** Help embed */
const help = (category, commands) =>
  base({
    color: config.colors.primary,
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
