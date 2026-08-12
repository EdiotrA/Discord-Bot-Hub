const { getSetting } = require('../database');
const { setSetting } = require('../database');
const Embed = require('../utils/embed');
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
      const joins = (joinBursts.get(guildId) || []).filter(timestamp => now - timestamp <= windowMs);
      joins.push(now);
      joinBursts.set(guildId, joins);
      if (joins.length >= threshold) {
        const lockUntil = now + 10 * 60 * 1000;
        setSetting(guildId, 'raid_lockdown_until', lockUntil);
        if (getSetting(guildId, 'antiraid_action', 'log') === 'timeout') {
          await member.timeout(10 * 60 * 1000, 'Anti-raid join burst').catch(() => {});
        }
        const logChannelId = getSetting(guildId, 'log_channel');
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (logChannel && Number(getSetting(guildId, 'raid_last_notice', 0)) < now - 60_000) {
          setSetting(guildId, 'raid_last_notice', now);
          await logChannel.send({ embeds: [Embed.warning('Raid Protection Triggered', `A rapid join burst was detected: **${joins.length} joins** within **${Math.round(windowMs / 1000)} seconds**.\n\nNew members are being monitored for the next 10 minutes.`)] }).catch(() => {});
        }
      }
    }

    // ── Welcome Message ────────────────────────────────────────────────────
    const welcomeChannel = getSetting(guildId, 'welcome_channel');
    const welcomeMessage = getSetting(guildId, 'welcome_message');

    if (welcomeChannel) {
      const channel = member.guild.channels.cache.get(welcomeChannel);
      if (channel) {
        const msg = (welcomeMessage || 'Welcome to **{server}**, {user}! We hope you enjoy your stay.')
          .replace('{user}', `<@${member.id}>`)
          .replace('{username}', member.user.username)
          .replace('{server}', member.guild.name)
          .replace('{membercount}', member.guild.memberCount);

        const embed = new (require('discord.js').EmbedBuilder)()
          .setColor(0x5865F2)
          .setTitle(`👋 Welcome to ${member.guild.name}!`)
          .setDescription(msg)
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: 'Member', value: member.user.tag, inline: true },
            { name: 'Member Count', value: `#${member.guild.memberCount}`, inline: true },
            { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
          )
          .setFooter({ text: `ID: ${member.id}` })
          .setTimestamp();

        channel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch(() => {});
      }
    }

    // ── Auto-Role ─────────────────────────────────────────────────────────
    const autoRoleId = getSetting(guildId, 'auto_role');
    if (autoRoleId) {
      const role = member.guild.roles.cache.get(autoRoleId);
      if (role) member.roles.add(role).catch(() => {});
    }

    // ── Log join ─────────────────────────────────────────────────────────
    const logChannel = getSetting(guildId, 'log_channel');
    if (logChannel) {
      const channel = member.guild.channels.cache.get(logChannel);
      if (channel) {
        channel.send({ embeds: [Embed.info('Member Joined', `<@${member.id}> (${member.user.tag}) has joined the server.\n\n**Account Age:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n**User ID:** ${member.id}`)] }).catch(() => {});
      }
    }
  },
};
