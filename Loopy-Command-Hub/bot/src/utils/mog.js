const { db } = require('../database');
const Economy = require('./economy');

const ITEMS = {
  pets: {
    fox:    { label: 'Lucky Fox',         price: 500,  bonus: 4,  description: '+4 Mog Score' },
    cat:    { label: 'Confidence Cat',    price: 1000, bonus: 6,  description: '+6 Mog Score' },
    dragon: { label: 'Mog Dragon',        price: 2500, bonus: 10, description: '+10 Mog Score' },
  },
  auras: {
    glow:   { label: 'Glow Aura',         price: 750,  bonus: 5,  description: '+5 Mog Score' },
    shadow: { label: 'Shadow Aura',       price: 1500, bonus: 8,  description: '+8 Mog Score' },
    royal:  { label: 'Royal Aura',        price: 3000, bonus: 12, description: '+12 Mog Score' },
  },
  powers: {
    stare:  { label: 'Unbreakable Stare', price: 1200, bonus: 7,  description: '+7 Mog Score' },
    walk:   { label: 'Perfect Walk',      price: 2000, bonus: 10, description: '+10 Mog Score' },
    crown:  { label: 'Crown of Confidence', price: 5000, bonus: 18, description: '+18 Mog Score' },
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
  if (account.wallet < item.price) return { error: `You need **${item.price.toLocaleString()}** coins. You have **${account.wallet.toLocaleString()}**.` };
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
  if (!owned) return { error: 'You don\'t own this item. Buy it from `/mog shop` first.' };
  const column = type === 'pets' ? 'pet' : type === 'auras' ? 'aura' : 'power';
  db.prepare(`UPDATE mog_profiles SET ${column} = ? WHERE guild_id = ? AND user_id = ?`).run(name, guildId, userId);
  return { item };
}

function scoreBonus(profile) {
  return ['pet', 'aura', 'power'].reduce((total, col) => {
    const category = col === 'pet' ? 'pets' : col === 'aura' ? 'auras' : 'powers';
    return total + (getItem(category, profile[col])?.bonus || 0);
  }, 0);
}

/**
 * Weighted Mog challenge.
 *
 * Score for each player = random base (0–60) + win-rate bonus (0–25)
 *   + points momentum bonus (0–10) + item bonus.
 *
 * Win-rate bonus means someone with 80% wins gets up to 25 more points
 * than someone on a losing streak, making top players more likely to win
 * without making it deterministic.
 *
 * Points awarded to winner = max(1, floor(score difference / 8)).
 * Higher skill gap → more points gained per win.
 */
function challenge(guildId, challengerId, targetId) {
  const challenger = ensureProfile(guildId, challengerId);
  const target = ensureProfile(guildId, targetId);

  function computeScore(profile) {
    const total = profile.wins + profile.losses;
    const winRate = total > 0 ? profile.wins / total : 0.5; // default 50% for new players
    const winRateBonus = winRate * 25;
    const momentumBonus = Math.min(profile.points, 200) / 200 * 10;
    const base = Math.random() * 60;
    return Math.round(base + winRateBonus + momentumBonus + scoreBonus(profile));
  }

  const challengerScore = computeScore(challenger);
  const targetScore = computeScore(target);
  const won = challengerScore >= targetScore;

  const winnerId = won ? challengerId : targetId;
  const loserId  = won ? targetId : challengerId;
  const winnerScore = won ? challengerScore : targetScore;
  const loserScore  = won ? targetScore : challengerScore;

  const pointsGained = Math.max(1, Math.floor(Math.abs(winnerScore - loserScore) / 8));

  db.prepare('UPDATE mog_profiles SET points = points + ?, wins = wins + 1 WHERE guild_id = ? AND user_id = ?')
    .run(pointsGained, guildId, winnerId);
  db.prepare('UPDATE mog_profiles SET losses = losses + 1 WHERE guild_id = ? AND user_id = ?')
    .run(guildId, loserId);

  return { won, challengerScore, targetScore, winnerId, loserId, pointsGained };
}

function leaderboard(guildId, limit = 10) {
  return db.prepare(
    'SELECT user_id, points, wins, losses FROM mog_profiles WHERE guild_id = ? ORDER BY points DESC, wins DESC LIMIT ?'
  ).all(guildId, limit);
}

function shopLines() {
  return Object.entries(ITEMS).flatMap(([type, items]) =>
    Object.entries(items).map(([, item]) =>
      `**${item.label}** — ${item.price.toLocaleString()} coins — ${item.description}`
    )
  );
}

/** Autocomplete choices for a given item type (optionally filtered to owned items). */
function itemChoices(type, guildId = null, userId = null) {
  const category = ITEMS[type];
  if (!category) return [];
  let owned = new Set();
  if (guildId && userId) {
    const rows = db.prepare('SELECT item_name FROM mog_inventory WHERE guild_id = ? AND user_id = ? AND item_type = ?')
      .all(guildId, userId, type);
    owned = new Set(rows.map(r => r.item_name));
  }
  return Object.entries(category).map(([name, item]) => ({
    name: `${item.label} — ${item.price.toLocaleString()} coins${owned.has(name) ? ' (owned)' : ''}`,
    value: name,
  }));
}

module.exports = { ITEMS, ensureProfile, inventory, getItem, buy, equip, scoreBonus, challenge, leaderboard, shopLines, itemChoices };
