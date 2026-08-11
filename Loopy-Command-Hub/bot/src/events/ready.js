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
    console.log(`[Loopy] Serving ${client.guilds.cache.size} guilds`);

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

    console.log('[Loopy] Ready! Auto-close and info channel crons started.');
  },
};
