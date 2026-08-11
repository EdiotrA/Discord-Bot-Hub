const { PermissionFlagsBits } = require('discord.js');
const { getSetting, db } = require('../database');
const AntiScam = require('../utils/antiScam');
const ExpUtil = require('../utils/exp');
const Embed = require('../utils/embed');
const AI = require('../utils/ai');
const ticketAiCooldowns = new Map();

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;

    // Keep ticket activity current for both messages and slash commands.
    const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'").get(message.channelId);
    if (ticket) {
      db.prepare('UPDATE tickets SET last_activity = ? WHERE channel_id = ?').run(Math.floor(Date.now() / 1000), message.channelId);
    }

    // ── Anti-Scam ─────────────────────────────────────────────────────────
    if (AntiScam.isEnabled(guildId)) {
      const check = AntiScam.isScam(message, guildId);
      if (check.detected) {
        // Check if member has Manage Messages (staff exempt)
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
          try {
            await message.delete();
            const warn = Embed.error('🛡️ Scam Detected', `${message.author}, your message was removed because it contained a potential scam link.\n\n**Reason:** ${check.reason}`);
            const reply = await message.channel.send({ embeds: [warn] });
            setTimeout(() => reply.delete().catch(() => {}), 10000);

            // Log
            const logChannel = getSetting(guildId, 'log_channel');
            if (logChannel) {
              const logCh = message.guild.channels.cache.get(logChannel);
              if (logCh) {
                await logCh.send({ embeds: [Embed.warning('Scam Link Detected & Removed', `**User:** ${message.author.tag} (${message.author.id})\n**Channel:** ${message.channel}\n**Reason:** ${check.reason}\n**Content:** \`\`\`${message.content.slice(0, 500)}\`\`\``)] });
              }
            }

            // Auto-warn
            db.prepare('INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)').run(
              guildId, message.author.id, message.client.user.id, `Auto-warn: Scam link detected (${check.reason})`
            );
            db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(
              guildId, 'AUTO_WARN_SCAM', message.client.user.id, message.author.id, check.reason
            );
          } catch (err) {
            console.error('[AntiScam]', err.message);
          }
          return;
        }
      }
    }

    // ── Anti-Link ─────────────────────────────────────────────────────────
    const antiLinkEnabled = getSetting(guildId, 'antilink_enabled');
    if (antiLinkEnabled) {
      const allowedRoles = JSON.parse(getSetting(guildId, 'antilink_allowed_roles') || '[]');
      const hasAllowed = message.member?.roles.cache.some(r => allowedRoles.includes(r.id));
      if (!hasAllowed && !message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        const urls = AntiScam.extractUrls(message.content);
        if (urls.length > 0) {
          try {
            await message.delete();
            const reply = await message.channel.send({ embeds: [Embed.error('Links Not Allowed', `${message.author}, links are not permitted in this channel.`)] });
            setTimeout(() => reply.delete().catch(() => {}), 8000);
          } catch {}
          return;
        }
      }
    }

    // ── Ping Protection ───────────────────────────────────────────────────
    const pingProtection = getSetting(guildId, 'ping_protection_enabled');
    if (pingProtection && (message.mentions.roles.size > 0 || message.mentions.users.size > 0)) {
      const protectedRoles = db.prepare('SELECT protected_role_id FROM ping_protection WHERE guild_id = ?').all(guildId).map(r => r.protected_role_id);
      const allowedRoles = db.prepare('SELECT allowed_role_id FROM ping_allowed_roles WHERE guild_id = ?').all(guildId).map(r => r.allowed_role_id);
      const protectedUsers = db.prepare('SELECT protected_user_id FROM ping_protected_users WHERE guild_id = ?').all(guildId).map(r => r.protected_user_id);
      const allowedUsers = db.prepare('SELECT user_id FROM ping_allowed_users WHERE guild_id = ?').all(guildId).map(r => r.user_id);

      const pingedProtected = message.mentions.roles.some(r => protectedRoles.includes(r.id));
      const pingedProtectedUser = message.mentions.users.some(u => protectedUsers.includes(u.id));
      const hasPermission = message.member?.roles.cache.some(r => allowedRoles.includes(r.id)) || allowedUsers.includes(message.author.id);

      if ((pingedProtected || pingedProtectedUser) && !hasPermission && !message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
        try {
          await message.delete();
          const reply = await message.channel.send({ embeds: [Embed.error('Ping Protection', `${message.author}, you don't have permission to ping that role.`)] });
          setTimeout(() => reply.delete().catch(() => {}), 8000);
        } catch {}
        return;
      }
    }

    // ── Owner-configured ticket AI ────────────────────────────────────────
    if (ticket) {
      const category = db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ? AND name = ?').get(guildId, ticket.category);
      const lastResponse = ticketAiCooldowns.get(message.channelId) || 0;
      if (category?.ai_enabled && Date.now() - lastResponse >= 20000) {
        ticketAiCooldowns.set(message.channelId, Date.now());
        try {
          const recent = await message.channel.messages.fetch({ limit: 8 });
          const transcript = [...recent.values()].reverse()
            .map(m => `${m.author.tag}: ${m.content || '[attachment/embed]'}`)
            .join('\n')
            .slice(-5000);
          const response = await AI.answerTicket(category.ai_instructions, category.label, transcript);
          if (response) await message.channel.send({ content: response.replace(/@everyone|@here/g, '@ staff') });
        } catch (error) {
          console.error('[Ticket AI]', error.message);
        }
      }
    }

    // ── Rules Enforcement (AI) ────────────────────────────────────────────
    const rulesEnforcement = getSetting(guildId, 'rules_enforcement_enabled');
    if (rulesEnforcement) {
      const rulesText = getSetting(guildId, 'rules_text');
      if (rulesText && message.content.length > 10) {
        // Probabilistic check (don't check every message - expensive)
        if (Math.random() < 0.05) {
          try {
            const result = await AI.evaluateRuleViolation(rulesText, `Message content: "${message.content.slice(0, 500)}"`);
            if (result.action && result.action !== 'warn' && result.confidence === 'high') {
              // Severe violation - take action
              await message.delete().catch(() => {});
              const reply = await message.channel.send({ embeds: [Embed.error('Rule Violation Detected', `${message.author}, your message was removed for violating server rules.\n**Reason:** ${result.reason}`)] });
              setTimeout(() => reply.delete().catch(() => {}), 15000);
            }
          } catch {}
        }
      }
    }

    // ── EXP System ───────────────────────────────────────────────────────
    const expEnabled = getSetting(guildId, 'exp_enabled');
    if (expEnabled !== false && expEnabled !== 'false') {
      if (ExpUtil.canGainExp(guildId, message.author.id)) {
        const gain = Math.floor(Math.random() * 11) + 10; // 10-20 EXP per message
        const result = ExpUtil.addExp(guildId, message.author.id, gain);

        if (result.leveled_up) {
          const levelUpChannel = getSetting(guildId, 'levelup_channel') || message.channel.id;
          const ch = message.guild.channels.cache.get(levelUpChannel) || message.channel;
          ch.send({ embeds: [Embed.levelUp(message.author, result.new_level)] }).catch(() => {});

          // Assign level roles
          const { getRolesForLevel } = require('../utils/exp');
          const roleIds = getRolesForLevel(guildId, result.new_level);
          for (const roleId of roleIds) {
            const role = message.guild.roles.cache.get(roleId);
            if (role) message.member?.roles.add(role).catch(() => {});
          }
        }
      }
    }
  },
};
