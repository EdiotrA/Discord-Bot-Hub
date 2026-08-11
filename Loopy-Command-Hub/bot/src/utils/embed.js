const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const timestamp = () => Math.floor(Date.now() / 1000);

/**
 * Success embed (green)
 */
const success = (title, description, fields = []) =>
  new EmbedBuilder()
    .setColor(config.colors.success)
    .setTitle(`${config.emojis.success} ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();

/**
 * Error embed (red)
 */
const error = (title, description) =>
  new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(`${config.emojis.error} ${title}`)
    .setDescription(description || null)
    .setTimestamp();

/**
 * Warning embed (yellow)
 */
const warning = (title, description) =>
  new EmbedBuilder()
    .setColor(config.colors.warning)
    .setTitle(`${config.emojis.warning} ${title}`)
    .setDescription(description || null)
    .setTimestamp();

/**
 * Info embed (blue/purple)
 */
const info = (title, description, fields = []) =>
  new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`${config.emojis.info} ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();

/**
 * Primary embed (branded, no emoji prefix)
 */
const primary = (title, description, fields = []) =>
  new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(title)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();

/**
 * Ticket embed
 */
const ticket = (title, description, fields = []) =>
  new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`${config.emojis.ticket} ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();

/**
 * Moderation embed (dark red)
 */
const moderation = (action, target, moderator, reason, extra = []) =>
  new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(`🔨 Moderation Action — ${action}`)
    .addFields(
      { name: 'Target', value: `<@${target.id}> (${target.tag})`, inline: true },
      { name: 'Moderator', value: `<@${moderator.id}> (${moderator.tag})`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: false },
      ...extra
    )
    .setThumbnail(target.displayAvatarURL({ dynamic: true }))
    .setFooter({ text: `User ID: ${target.id}` })
    .setTimestamp();

/**
 * Level-up embed
 */
const levelUp = (user, level) =>
  new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(`⭐ Level Up!`)
    .setDescription(`Congratulations ${user}, you've reached **Level ${level}**!`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

/**
 * Music embed
 */
const music = (title, description, thumbnail = null, fields = []) => {
  const embed = new EmbedBuilder()
    .setColor(config.colors.purple)
    .setTitle(`${config.emojis.music} ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
};

/**
 * Roblox embed
 */
const roblox = (title, description, fields = [], thumbnail = null) => {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`${config.emojis.roblox} ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
};

/**
 * Application embed
 */
const application = (title, description, fields = [], color = config.colors.primary) =>
  new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();

/**
 * Leaderboard embed
 */
const leaderboard = (title, description, entries) =>
  new EmbedBuilder()
    .setColor(config.colors.gold)
    .setTitle(`🏆 ${title}`)
    .setDescription(description || null)
    .addFields(entries)
    .setTimestamp();

/**
 * Game embed
 */
const game = (title, description, fields = [], color = config.colors.purple) =>
  new EmbedBuilder()
    .setColor(color)
    .setTitle(`${config.emojis.game} ${title}`)
    .setDescription(description || null)
    .addFields(fields)
    .setTimestamp();

/**
 * Help embed
 */
const help = (category, commands) =>
  new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📚 Loopy Help — ${category}`)
    .setDescription(commands.map(c => `\`/${c.name}\` — ${c.description}`).join('\n'))
    .setFooter({ text: 'Use /help [command] for detailed info on a specific command' })
    .setTimestamp();

module.exports = { success, error, warning, info, primary, ticket, moderation, levelUp, music, roblox, application, leaderboard, game, help };
