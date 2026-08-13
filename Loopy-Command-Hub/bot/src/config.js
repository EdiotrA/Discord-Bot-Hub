const config = {
  colors: {
    primary: 0x6366F1,    // indigo — Loopy brand
    success: 0x22C55E,    // vibrant green
    error: 0xEF4444,      // clean red
    warning: 0xF59E0B,    // amber
    info: 0x38BDF8,       // sky blue
    purple: 0xA855F7,     // vivid purple
    gold: 0xFACC15,       // rich gold
    dark: 0x1E1F22,       // discord dark
    music: 0x8B5CF6,      // violet
    roblox: 0xE2231A,     // roblox signature red
    ticket: 0x6366F1,     // matches brand
    moderation: 0xDC2626, // crimson
    game: 0xA855F7,       // vivid purple
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
