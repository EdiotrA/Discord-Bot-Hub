const { db, getSetting } = require('../database');
const config = require('../config');

/**
 * Calculate level from total EXP
 */
function getLevel(exp) {
  return Math.floor(0.1 * Math.sqrt(exp));
}

/**
 * Calculate EXP needed for a given level
 */
function getExpForLevel(level) {
  return Math.pow(level / 0.1, 2);
}

/**
 * Calculate EXP needed to reach next level
 */
function getExpToNextLevel(exp) {
  const currentLevel = getLevel(exp);
  const nextLevelExp = getExpForLevel(currentLevel + 1);
  return Math.ceil(nextLevelExp - exp);
}

/**
 * Get or create user EXP record
 */
function getUser(guildId, userId) {
  return db.prepare('SELECT * FROM exp WHERE guild_id = ? AND user_id = ?').get(guildId, userId) ||
    { guild_id: guildId, user_id: userId, exp: 0, level: 0, total_messages: 0, last_exp_at: 0 };
}

/**
 * Add EXP to a user, returns { leveled_up, old_level, new_level, exp_gained }
 */
function addExp(guildId, userId, amount) {
  const user = getUser(guildId, userId);
  const oldLevel = getLevel(user.exp);
  const newExp = user.exp + amount;
  const newLevel = getLevel(newExp);

  db.prepare(`
    INSERT INTO exp (guild_id, user_id, exp, level, total_messages, last_exp_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      exp = exp + ?,
      level = ?,
      total_messages = total_messages + 1,
      last_exp_at = ?
  `).run(guildId, userId, newExp, newLevel, 1, Date.now(), amount, newLevel, Date.now());

  return {
    leveled_up: newLevel > oldLevel,
    old_level: oldLevel,
    new_level: newLevel,
    exp_gained: amount,
    total_exp: newExp,
  };
}

/**
 * Set user EXP directly
 */
function setExp(guildId, userId, amount) {
  const level = getLevel(amount);
  db.prepare(`
    INSERT INTO exp (guild_id, user_id, exp, level)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET exp = ?, level = ?
  `).run(guildId, userId, amount, level, amount, level);
}

/**
 * Reset user EXP
 */
function resetExp(guildId, userId) {
  db.prepare('DELETE FROM exp WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

/**
 * Get server leaderboard
 */
function getLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT user_id, exp, level, total_messages FROM exp WHERE guild_id = ? ORDER BY exp DESC LIMIT ?').all(guildId, limit);
}

/**
 * Get user rank on leaderboard
 */
function getUserRank(guildId, userId) {
  const row = db.prepare(`
    SELECT COUNT(*) + 1 AS rank FROM exp WHERE guild_id = ? AND exp > (
      SELECT COALESCE(exp, 0) FROM exp WHERE guild_id = ? AND user_id = ?
    )
  `).get(guildId, guildId, userId);
  return row?.rank || 1;
}

/**
 * Check if user can gain EXP (cooldown)
 */
function canGainExp(guildId, userId) {
  const user = getUser(guildId, userId);
  return (Date.now() - user.last_exp_at) >= config.expCooldown;
}

/**
 * Get level roles for a guild
 */
function getLevelRoles(guildId) {
  return db.prepare('SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level').all(guildId);
}

/**
 * Get roles that should be assigned for a given level
 */
function getRolesForLevel(guildId, level) {
  return db.prepare('SELECT role_id FROM level_roles WHERE guild_id = ? AND level <= ? ORDER BY level DESC').all(guildId, level).map(r => r.role_id);
}

module.exports = { getLevel, getExpForLevel, getExpToNextLevel, getUser, addExp, setExp, resetExp, getLeaderboard, getUserRank, canGainExp, getLevelRoles, getRolesForLevel };
