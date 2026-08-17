const { db } = require('../database');

const STARTING_WALLET = 250;
const MAX_WAGER = 1000000;

function ensureAccount(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO economy (guild_id, user_id, wallet) VALUES (?, ?, ?)')
    .run(guildId, userId, STARTING_WALLET);
  return db.prepare('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function getBalance(guildId, userId) {
  return ensureAccount(guildId, userId);
}

function changeWallet(guildId, userId, amount) {
  ensureAccount(guildId, userId);
  const result = db.prepare(
    'UPDATE economy SET wallet = wallet + ?, total_won = total_won + ?, total_lost = total_lost + ? WHERE guild_id = ? AND user_id = ? AND wallet + ? >= 0'
  ).run(amount, Math.max(0, amount), Math.max(0, -amount), guildId, userId, amount);
  if (!result.changes) return false;
  return getBalance(guildId, userId);
}

function transfer(guildId, fromId, toId, amount) {
  amount = Math.floor(Number(amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_WAGER || fromId === toId) return null;
  ensureAccount(guildId, fromId);
  ensureAccount(guildId, toId);
  const transaction = db.transaction(() => {
    const debit = db.prepare('UPDATE economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ? AND wallet >= ?')
      .run(amount, guildId, fromId, amount);
    if (!debit.changes) return false;
    db.prepare('UPDATE economy SET wallet = wallet + ? WHERE guild_id = ? AND user_id = ?').run(amount, guildId, toId);
    return true;
  });
  return transaction() ? { amount, from: getBalance(guildId, fromId), to: getBalance(guildId, toId) } : null;
}

function claimDaily(guildId, userId) {
  const account = ensureAccount(guildId, userId);
  const now = Math.floor(Date.now() / 1000);
  if (now - account.daily_at < 86400) return { claimed: false, remaining: 86400 - (now - account.daily_at), account };
  const streak = now - account.daily_at <= 172800 ? account.daily_streak + 1 : 1;
  const amount = 250 + Math.min(streak, 7) * 50;
  db.prepare('UPDATE economy SET wallet = wallet + ?, daily_at = ?, daily_streak = ?, total_won = total_won + ? WHERE guild_id = ? AND user_id = ?')
    .run(amount, now, streak, amount, guildId, userId);
  return { claimed: true, amount, streak, account: getBalance(guildId, userId) };
}

function leaderboard(guildId, limit = 10) {
  return db.prepare('SELECT user_id, wallet, bank, (wallet + bank) AS total FROM economy WHERE guild_id = ? ORDER BY total DESC LIMIT ?')
    .all(guildId, limit);
}

/**
 * Global leaderboard ranked by total_won (gameplay earnings only).
 * Admin-received coins are excluded so they cannot inflate global rank.
 */
function globalLeaderboard(limit = 10) {
  return db.prepare(`
    SELECT user_id,
           SUM(total_won)                                   AS earned,
           SUM(wallet + bank)                               AS total_balance,
           SUM(admin_received)                              AS gifted,
           COUNT(DISTINCT guild_id)                         AS server_count
    FROM economy
    GROUP BY user_id
    ORDER BY earned DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Admin-give coins to a user, tracked separately so global rankings stay clean.
 * Returns false if the user account doesn't exist yet (call ensureAccount first).
 */
function adminGive(guildId, userId, amount) {
  amount = Math.floor(Number(amount));
  if (!Number.isFinite(amount) || amount === 0) return false;
  ensureAccount(guildId, userId);
  if (amount > 0) {
    db.prepare('UPDATE economy SET wallet = wallet + ?, admin_received = admin_received + ? WHERE guild_id = ? AND user_id = ?')
      .run(amount, amount, guildId, userId);
  } else {
    // Taking coins away — clamp at 0, don't touch admin_received
    db.prepare('UPDATE economy SET wallet = MAX(0, wallet + ?) WHERE guild_id = ? AND user_id = ?')
      .run(amount, guildId, userId);
  }
  return getBalance(guildId, userId);
}

function canSteal(guildId, userId) {
  const account = ensureAccount(guildId, userId);
  const remaining = 3600 - (Math.floor(Date.now() / 1000) - account.last_steal_at);
  return { allowed: remaining <= 0, remaining };
}

function markSteal(guildId, userId) {
  db.prepare('UPDATE economy SET last_steal_at = ? WHERE guild_id = ? AND user_id = ?')
    .run(Math.floor(Date.now() / 1000), guildId, userId);
}

function steal(guildId, thiefId, victimId) {
  if (thiefId === victimId) return null;
  ensureAccount(guildId, thiefId);
  ensureAccount(guildId, victimId);
  const transaction = db.transaction(() => {
    const victim = db.prepare('SELECT wallet FROM economy WHERE guild_id = ? AND user_id = ?').get(guildId, victimId);
    if (!victim?.wallet) return null;
    const amount = Math.max(1, Math.min(victim.wallet, Math.floor(victim.wallet * (0.1 + Math.random() * 0.2))));
    const debit = db.prepare('UPDATE economy SET wallet = wallet - ?, total_lost = total_lost + ? WHERE guild_id = ? AND user_id = ? AND wallet >= ?')
      .run(amount, amount, guildId, victimId, amount);
    if (!debit.changes) return null;
    db.prepare('UPDATE economy SET wallet = wallet + ?, total_won = total_won + ? WHERE guild_id = ? AND user_id = ?')
      .run(amount, amount, guildId, thiefId);
    return amount;
  });
  return transaction();
}

function formatTime(seconds) {
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

module.exports = { STARTING_WALLET, MAX_WAGER, ensureAccount, getBalance, changeWallet, transfer, claimDaily, leaderboard, globalLeaderboard, adminGive, canSteal, markSteal, steal, formatTime };