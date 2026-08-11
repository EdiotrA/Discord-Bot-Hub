const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Load environment
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) { console.error('[Loopy] Missing DISCORD_BOT_TOKEN'); process.exit(1); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

// ── Load Commands ────────────────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
function loadCommands(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommands(fullPath);
    } else if (entry.name.endsWith('.js') && !entry.name.startsWith('_')) {
      try {
        const command = require(fullPath);
         if (command?.data?.name) {
           command.category = path.basename(dir);
          client.commands.set(command.data.name, command);
        }
      } catch (err) {
        console.error(`[Commands] Failed to load ${fullPath}:`, err.message);
      }
    }
  }
}
loadCommands(commandsPath);
console.log(`[Loopy] Loaded ${client.commands.size} commands`);

// ── Load Events ──────────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}
console.log(`[Loopy] Loaded ${eventFiles.length} events`);

// ── Music ────────────────────────────────────────────────────────────────────
try {
  require('./utils/music');
  console.log('[Loopy] Discord voice music loaded');
} catch (err) {
  console.warn('[Loopy] Music not available:', err.message);
}

// ── Login ────────────────────────────────────────────────────────────────────
client.login(token).catch(err => {
  console.error('[Loopy] Login failed:', err.message);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
process.on('unhandledRejection', err => console.error('[Unhandled]', err));
process.on('uncaughtException', err => console.error('[Uncaught]', err));
