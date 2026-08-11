const config = {
  colors: {
    primary: 0x5865F2,
    success: 0x57F287,
    error: 0xED4245,
    warning: 0xFEE75C,
    info: 0x5865F2,
    purple: 0x9B59B6,
    gold: 0xF1C40F,
    dark: 0x2F3136,
  },
  emojis: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
    ticket: '🎫',
    music: '🎵',
    shield: '🛡️',
    star: '⭐',
    crown: '👑',
    lock: '🔒',
    unlock: '🔓',
    ban: '🔨',
    kick: '👢',
    mute: '🔇',
    warn: '⚠️',
    roblox: '🟥',
    level: '📈',
    coin: '🪙',
    game: '🎮',
  },
  defaultTicketTimeout: 24 * 60, // 24 hours in minutes
  maxWarningsBeforeBan: 5,
  expPerMessage: 15,
  expCooldown: 60000, // 1 minute cooldown
  expLevelMultiplier: 100, // level * 100 = exp needed
  musicMaxQueue: 100,
  musicMaxDuration: 3 * 60 * 60, // 3 hours in seconds
  scamDomains: [
    'nitro-free.ru', 'discordapp.com.ru', 'discordnitro.gift', 'discord-nitro.ru',
    'free-nitro.ru', 'steamcommunity.ru', 'steamc0mmunity.com', 'discord.gift.ru',
    'dlscord.com', 'disçord.com', 'dlscordapp.com', 'freeboost.ru',
    'discord-free-nitro.com', 'dicsord.com', 'discrod.com',
  ],
  version: '1.0.0',
  supportServer: 'https://discord.gg/loopy',
};

module.exports = config;
