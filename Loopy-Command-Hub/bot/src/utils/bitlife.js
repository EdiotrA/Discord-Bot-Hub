const { db } = require('../database');

function ensure(guildId, userId) {
  return db.prepare('SELECT * FROM bitlife_profiles WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
}

function start(guildId, userId) {
  const existing = ensure(guildId, userId);
  if (existing?.alive) return { existing };
  db.prepare('INSERT OR REPLACE INTO bitlife_profiles (guild_id, user_id, age, cash, health, happiness, intelligence, career, alive, last_action) VALUES (?, ?, 18, 500, 100, 75, 50, ?, 1, 0)')
    .run(guildId, userId, 'Student');
  return { profile: ensure(guildId, userId) };
}

function action(guildId, userId, type) {
  const profile = ensure(guildId, userId);
  if (!profile || !profile.alive) return { error: 'Start a new life with `/bitlife start`.' };
  if (Math.floor(Date.now() / 1000) - profile.last_action < 10) return { error: 'Slow down — wait a few seconds between life choices.' };
  const changes = {
    work: { cash: 700 + Math.floor(Math.random() * 800), happiness: -5, health: -2, career: 'Professional' },
    study: { intelligence: 5, happiness: -2, cash: -50, career: 'Student' },
    relax: { happiness: 10, health: 2, cash: -25 },
    exercise: { health: 8, happiness: 3, cash: -15 },
  }[type];
  if (!changes) return { error: 'Unknown life action.' };
  const next = { ...profile };
  for (const [key, value] of Object.entries(changes)) next[key] = key === 'career' ? value : next[key] + value;
  next.health = Math.max(0, Math.min(100, next.health));
  next.happiness = Math.max(0, Math.min(100, next.happiness));
  next.intelligence = Math.max(0, Math.min(100, next.intelligence));
  if (next.cash < 0) next.cash = 0;
  db.prepare('UPDATE bitlife_profiles SET cash = ?, health = ?, happiness = ?, intelligence = ?, career = ?, last_action = ? WHERE guild_id = ? AND user_id = ?')
    .run(next.cash, next.health, next.happiness, next.intelligence, next.career, Math.floor(Date.now() / 1000), guildId, userId);
  return { profile: ensure(guildId, userId), changes };
}

function ageUp(guildId, userId) {
  const profile = ensure(guildId, userId);
  if (!profile || !profile.alive) return { error: 'Start a new life with `/bitlife start`.' };
  const age = profile.age + 1;
  const deathChance = Math.min(0.03 + Math.max(0, age - 60) * 0.01 + (100 - profile.health) * 0.001, 0.95);
  const alive = age < 110 && Math.random() > deathChance ? 1 : 0;
  db.prepare('UPDATE bitlife_profiles SET age = ?, alive = ?, last_action = ? WHERE guild_id = ? AND user_id = ?')
    .run(age, alive, Math.floor(Date.now() / 1000), guildId, userId);
  return { profile: ensure(guildId, userId), died: !alive };
}

function leaderboard(guildId) {
  return db.prepare('SELECT user_id, age, cash, career FROM bitlife_profiles WHERE guild_id = ? AND alive = 1 ORDER BY cash DESC LIMIT 10').all(guildId);
}

module.exports = { ensure, start, action, ageUp, leaderboard };