const { ActivityType } = require('discord.js');
const cron = require('node-cron');
const { db, getSetting } = require('../database');
const AI = require('../utils/ai');
const Embed = require('../utils/embed');

const activities = [
  { name: '/help | Loopy Bot', type: ActivityType.Playing },
  { name: 'over the server', type: ActivityType.Watching },
  { name: 'your commands', type: ActivityType.Listening },
  { name: 'Roblox', type: ActivityType.Playing },
  { name: 'with slash commands', type: ActivityType.Playing },
];
let activityIndex = 0;

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`[Loopy] Logged in as ${client.user.tag}`);
    Embed.setClient(client); // brand embeds with bot avatar
    console.log(`[Loopy] Serving ${client.guilds.cache.size} guilds`);

    // Register from the loaded command collection so a separate client ID
    // secret and a second deploy workflow are not required.
    try {
      // Discord permits 100 global slash commands. These older, low-use
      // modules remain in the codebase but are intentionally not exposed in
      // the slash menu so the click-ready hub and current core commands fit.
      const hiddenLegacyCommands = new Set([
        'applicationview',
        'backgroundcheck',
        'dadjoke',
        'dice',
        'fact',
        'fortune',
        'truthordare',
        'wouldyourather',
        // Replaced by the unified /group command
        'setgroup',
        'botjoingroup',
        'groupinfo',
        // Verify log exposed as /setup verifylog subcommand
        'verifylog',
      ]);
      const commands = [...client.commands.values()]
        .filter(command => !hiddenLegacyCommands.has(command.data.name))
        .map(command => command.data.toJSON());
      await client.application.commands.set(commands);
      console.log(`[Loopy] Registered ${commands.length} slash commands`);
    } catch (error) {
      console.error('[Loopy] Command registration failed:', error.message);
    }

    // Rotate presence
    const rotate = () => {
      client.user.setPresence({
        activities: [activities[activityIndex % activities.length]],
        status: 'online',
      });
      activityIndex++;
    };
    rotate();
    setInterval(rotate, 30000);

    // Auto-close inactive tickets every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        const now = Math.floor(Date.now() / 1000);
        const openTickets = db.prepare("SELECT * FROM tickets WHERE status = 'open'").all();

        for (const t of openTickets) {
          const category = db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ? AND name = ?').get(t.guild_id, t.category);
          if (!category?.auto_close_enabled) continue;

          const timeoutMins = category.timeout_minutes || 1440;
          const inactiveSeconds = now - t.last_activity;

          if (inactiveSeconds >= timeoutMins * 60) {
            const guild = client.guilds.cache.get(t.guild_id);
            if (!guild) continue;
            const channel = guild.channels.cache.get(t.channel_id);
            if (!channel) {
              db.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?").run(now, t.channel_id);
              continue;
            }
            try {
              await channel.send({ embeds: [Embed.warning('Ticket Auto-Closing', `This ticket has been inactive for ${Math.floor(inactiveSeconds / 60)} minutes and will now be closed automatically.`)] });
              await channel.delete('Auto-closed due to inactivity');
              db.prepare("UPDATE tickets SET status = 'closed', closed_at = ? WHERE channel_id = ?").run(now, t.channel_id);

              const logChannel = category.log_channel_id ? guild.channels.cache.get(category.log_channel_id) : null;
              const globalLog = getSetting(t.guild_id, 'ticket_log_channel');
              const logCh = logChannel || (globalLog ? guild.channels.cache.get(globalLog) : null);
              if (logCh) {
                await logCh.send({ embeds: [Embed.info('Ticket Auto-Closed', `Ticket for <@${t.user_id}> was auto-closed after ${Math.floor(inactiveSeconds / 60)} minutes of inactivity.`)] });
              }
            } catch (err) {
              console.error('[AutoClose]', err.message);
            }
          }
        }
      } catch (err) {
        console.error('[AutoClose Cron]', err.message);
      }
    });

    // Daily info channel posts
    cron.schedule('0 9 * * *', async () => {
      try {
        const channels = db.prepare("SELECT * FROM info_channels WHERE is_active = 1 AND (schedule = 'daily' OR schedule IS NULL)").all();
        for (const ic of channels) {
          const guild = client.guilds.cache.get(ic.guild_id);
          if (!guild) continue;
          const channel = guild.channels.cache.get(ic.channel_id);
          if (!channel) continue;
          const content = await AI.generateInfo(ic.topic, guild.name);
          if (content) {
            const embed = Embed.info(`Daily Update — ${ic.topic}`, content);
            await channel.send({ embeds: [embed] });
            db.prepare('UPDATE info_channels SET last_posted = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), ic.id);
          }
        }
      } catch (err) {
        console.error('[InfoChannel Cron]', err.message);
      }
    });

    // Auto-join linked Roblox groups — the bot account joins (or requests to
    // join) every group linked via /group set, without anyone lifting a finger.
    (async () => {
      try {
        const Roblox = require('../utils/roblox');
        if (!process.env.ROBLOX_COOKIE) return;
        const rows = db.prepare("SELECT DISTINCT guild_id, value FROM guild_settings WHERE key = 'roblox_group_id'").all();
        const groupIds = [...new Set(rows.map(r => { try { return String(JSON.parse(r.value)); } catch { return String(r.value); } }))];
        for (const groupId of groupIds) {
          if (!/^\d+$/.test(groupId)) continue;
          const result = await Roblox.ensureBotInGroup(groupId);
          if (result.status === 'joined') console.log(`[Roblox] Bot account joined group ${groupId}`);
          else if (result.status === 'requested') console.log(`[Roblox] Bot account sent join request to group ${groupId} (awaiting approval)`);
          else if (result.status === 'captcha') console.warn(`[Roblox] Group ${groupId}: ${result.error}`);
          else if (result.status === 'failed') console.error(`[Roblox] Could not join group ${groupId}: ${result.error}`);
        }
      } catch (err) {
        console.error('[Roblox AutoJoin]', err.message);
      }
    })();

    // Resume timers for polls and giveaways that were running before restart
    try {
      const { schedulePoll, endPoll } = require('../commands/fun/poll');
      const { scheduleGiveaway, endGiveaway } = require('../commands/fun/giveaway');
      const now = Math.floor(Date.now() / 1000);
      for (const poll of db.prepare('SELECT * FROM polls WHERE ended = 0').all()) {
        if (poll.ends_at <= now) endPoll(client, poll.message_id);
        else schedulePoll(client, poll);
      }
      for (const giveaway of db.prepare('SELECT * FROM giveaways WHERE ended = 0').all()) {
        if (giveaway.ends_at <= now) endGiveaway(client, giveaway.message_id);
        else scheduleGiveaway(client, giveaway);
      }
    } catch (err) {
      console.error('[Resume] Failed to resume polls/giveaways:', err.message);
    }

    console.log('[Loopy] Ready! Auto-close and info channel crons started.');
  },
};
