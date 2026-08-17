const { EmbedBuilder } = require('discord.js');
const { getSetting, setSetting } = require('../database');
const Embed = require('../utils/embed');
const config = require('../config');

const joinBursts = new Map();

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const guildId = member.guild.id;

    // ── Join-burst raid protection ─────────────────────────────────────────
    if (getSetting(guildId, 'antiraid_enabled')) {
      const now = Date.now();
      const windowMs = Number(getSetting(guildId, 'antiraid_window_seconds', 10)) * 1000;
      const threshold = Number(getSetting(guildId, 'antiraid_threshold', 5));
      const joins = (joinBursts.get(guildId) || []).filter(t => now - t <= windowMs);
      joins.push(now);
      joinBursts.set(guildId, joins);

      if (joins.length >= threshold) {
        setSetting(guildId, 'raid_lockdown_until', now + 10 * 60 * 1000);
        if (getSetting(guildId, 'antiraid_action', 'log') === 'timeout') {
          await member.timeout(10 * 60 * 1000, 'Anti-raid join burst').catch(() => {});
        }
        const logChannelId = getSetting(guildId, 'log_channel');
        if (logChannelId && Number(getSetting(guildId, 'raid_last_notice', 0)) < now - 60_000) {
          setSetting(guildId, 'raid_last_notice', now);
          const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);
          if (logChannel) {
            await logChannel.send({
              embeds: [Embed.warning('Raid Protection Triggered',
                `A rapid join burst was detected: **${joins.length} joins** within **${Math.round(windowMs / 1000)} seconds**.\n\nNew members are being monitored for the next 10 minutes.`)],
            }).catch(err => console.error(`[antiraid] Failed to send raid notice in ${guildId}:`, err));
          }
        }
      }
    }

    // ── Welcome Message ────────────────────────────────────────────────────
    const welcomeChannelId = getSetting(guildId, 'welcome_channel');

    if (welcomeChannelId) {
      // Always fetch — never rely on cache, which may be empty for unused channels
      const channel = await member.guild.channels.fetch(welcomeChannelId).catch(err => {
        console.error(`[welcome] Could not fetch channel ${welcomeChannelId} in guild ${guildId}:`, err.message);
        return null;
      });

      if (!channel) {
        console.warn(`[welcome] Channel ${welcomeChannelId} not found in guild ${guildId} — was it deleted?`);
      } else if (!channel.isTextBased()) {
        console.warn(`[welcome] Channel ${welcomeChannelId} in guild ${guildId} is not a text channel.`);
      } else {
        const welcomeMessage = getSetting(guildId, 'welcome_message') ||
          'Welcome to **{server}**, {user}! We hope you enjoy your stay.';

        const msg = welcomeMessage
          .replace(/{user}/g, `<@${member.id}>`)
          .replace(/{username}/g, member.user.username)
          .replace(/{server}/g, member.guild.name)
          .replace(/{membercount}/g, member.guild.memberCount);

        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle(`👋  Welcome to ${member.guild.name}!`)
          .setDescription(`${Embed.divider}\n${msg}\n${Embed.divider}`)
          .setThumbnail(member.user.displayAvatarURL({ size: 64 }))
          .addFields(
            Embed.field('Member', `<@${member.id}>`, true),
            Embed.field('Member Count', `\`#${member.guild.memberCount}\``, true),
            Embed.field('Account Created', `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, true),
          )
          .setFooter(Embed.brandFooter(`ID: ${member.id}`))
          .setTimestamp();

        await channel.send({ content: `<@${member.id}>`, embeds: [embed] })
          .catch(err => console.error(`[welcome] Failed to send welcome message in channel ${welcomeChannelId} (guild ${guildId}):`, err.message));
      }
    }

    // ── Auto-Role ─────────────────────────────────────────────────────────
    const autoRoleId = getSetting(guildId, 'auto_role');
    if (autoRoleId) {
      const role = member.guild.roles.cache.get(autoRoleId)
        || await member.guild.roles.fetch(autoRoleId).catch(() => null);
      if (role) {
        await member.roles.add(role).catch(err =>
          console.error(`[autorole] Failed to assign role ${autoRoleId} in guild ${guildId}:`, err.message));
      }
    }

    // ── Log join ─────────────────────────────────────────────────────────
    const logChannelId = getSetting(guildId, 'log_channel');
    if (logChannelId) {
      const logChannel = await member.guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel?.isTextBased()) {
        await logChannel.send({
          embeds: [Embed.info('Member Joined',
            `<@${member.id}> (${member.user.username}) has joined the server.\n\n> **Account Age:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n> **User ID:** \`${member.id}\``)],
        }).catch(err => console.error(`[log] Failed to log join in ${guildId}:`, err.message));
      }
    }
  },
};
