const { db } = require('../database');
const Economy = require('./economy');

const ITEMS = {
  pets: {
    fox: { label: 'Lucky Fox', price: 500, bonus: 4, description: '+4 mog score' },
    dragon: { label: 'Mog Dragon', price: 2500, bonus: 10, description: '+10 mog score' },
    cat: { label: 'Confidence Cat', price: 1000, bonus: 6, description: '+6 mog score' },
  },
  auras: {
    glow: { label: 'Glow Aura', price: 750, bonus: 5, description: '+5 mog score' },
    royal: { label: 'Royal Aura', price: 3000, bonus: 12, description: '+12 mog score' },
    shadow: { label: 'Shadow Aura', price: 1500, bonus: 8, description: '+8 mog score' },
  },
  powers: {
    stare: { label: 'Unbreakable Stare', price: 1200, bonus: 7, description: '+7 mog score' },
    walk: { label: 'Perfect Walk', price: 2000, bonus: 10, description: '+10 mog score' },
    crown: { label: 'Crown of Confidence', price: 5000, bonus: 18, description: '+18 mog score' },
  },
};

function ensureProfile(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO mog_profiles (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
  return db.prepare('SELECT * FROM mog_profiles WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function inventory(guildId, userId) {
  return db.prepare('SELECT item_type, item_name FROM mog_inventory WHERE guild_id = ? AND user_id = ? ORDER BY item_type, item_name')
    .all(guildId, userId);
}

function getItem(type, name) {
  return ITEMS[type]?.[name] || null;
}

function buy(guildId, userId, type, name) {
  const item = getItem(type, name);
  if (!item) return { error: 'Item not found.' };
  const alreadyOwned = db.prepare('SELECT 1 FROM mog_inventory WHERE guild_id = ? AND user_id = ? AND item_type = ? AND item_name = ?')
    .get(guildId, userId, type, name);
  if (alreadyOwned) return { error: 'You already own this item.' };
  const account = Economy.getBalance(guildId, userId);
  if (account.wallet < item.price) return { error: `You need ${item.price.toLocaleString()} coins.` };
  Economy.changeWallet(guildId, userId, -item.price);
  db.prepare('INSERT INTO mog_inventory (guild_id, user_id, item_type, item_name) VALUES (?, ?, ?, ?)')
    .run(guildId, userId, type, name);
  return { item };
}

function equip(guildId, userId, type, name) {
  const item = getItem(type, name);
  if (!item) return { error: 'Item not found.' };
  const owned = db.prepare('SELECT 1 FROM mog_inventory WHERE guild_id = ? AND user_id = ? AND item_type = ? AND item_name = ?')
    .get(guildId, userId, type, name);
  if (!owned) return { error: 'Buy this item from `/mog shop` first.' };
  const column = type === 'pets' ? 'pet' : type === 'auras' ? 'aura' : 'power';
  db.prepare(`UPDATE mog_profiles SET ${column} = ? WHERE guild_id = ? AND user_id = ?`).run(name, guildId, userId);
  return { item };
}

function scoreBonus(profile) {
  return ['pet', 'aura', 'power'].reduce((total, column) => total + (getItem(column === 'pet' ? 'pets' : column === 'aura' ? 'auras' : 'powers', profile[column])?.bonus || 0), 0);
}

function challenge(guildId, winnerId, loserId) {
  const winner = ensureProfile(guildId, winnerId);
  const loser = ensureProfile(guildId, loserId);
  const winnerScore = Math.floor(Math.random() * 101) + scoreBonus(winner);
  const loserScore = Math.floor(Math.random() * 101) + scoreBonus(loser);
  const won = winnerScore >= loserScore;
  const winnerIdFinal = won ? winnerId : loserId;
  const loserIdFinal = won ? loserId : winnerId;
  db.prepare('UPDATE mog_profiles SET points = points + 1, wins = wins + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, winnerIdFinal);
  db.prepare('UPDATE mog_profiles SET losses = losses + 1 WHERE guild_id = ? AND user_id = ?').run(guildId, loserIdFinal);
  return { won, winnerScore, loserScore, winnerId: winnerIdFinal, loserId: loserIdFinal };
}

function leaderboard(guildId, limit = 10) {
  return db.prepare('SELECT user_id, points, wins, losses FROM mog_profiles WHERE guild_id = ? ORDER BY points DESC, wins DESC LIMIT ?').all(guildId, limit);
}

function shopLines() {
  return Object.entries(ITEMS).flatMap(([type, items]) => Object.entries(items).map(([name, item]) => `**${type.slice(0, -1)}:${name}** — ${item.price.toLocaleString()} coins — ${item.description}`));
}

module.exports = { ITEMS, ensureProfile, inventory, getItem, buy, equip, scoreBonus, challenge, leaderboard, shopLines };