const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(path.join(dbDir, 'loopy.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Keep the small better-sqlite3-style transaction helper used by the
// permission bulk-update code while using Node 24's built-in SQLite driver.
db.transaction = (callback) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = callback(...args);
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

// ── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (guild_id, key)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'general',
    status TEXT DEFAULT 'open',
    claimed_by TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    closed_at INTEGER,
    last_activity INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS ticket_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    emoji TEXT DEFAULT '🎫',
    description TEXT,
    support_role_ids TEXT DEFAULT '[]',
    log_channel_id TEXT,
    parent_category_id TEXT,
    timeout_minutes INTEGER DEFAULT 1440,
    max_open INTEGER DEFAULT 1,
    auto_close_enabled INTEGER DEFAULT 1,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    answers TEXT DEFAULT '{}',
    submitted_at INTEGER DEFAULT (unixepoch()),
    reviewed_by TEXT,
    reviewed_at INTEGER,
    review_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS application_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    questions TEXT DEFAULT '[]',
    reviewer_role_ids TEXT DEFAULT '[]',
    result_channel_id TEXT,
    is_open INTEGER DEFAULT 1,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS loa_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    start_date INTEGER NOT NULL,
    end_date INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role_id TEXT NOT NULL,
    UNIQUE(guild_id, message_id, emoji)
  );

  CREATE TABLE IF NOT EXISTS rankbinds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    roblox_group_id TEXT NOT NULL,
    roblox_rank_id INTEGER NOT NULL,
    roblox_rank_name TEXT NOT NULL,
    discord_role_id TEXT NOT NULL,
    UNIQUE(guild_id, roblox_group_id, roblox_rank_id)
  );

  CREATE TABLE IF NOT EXISTS verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    discord_user_id TEXT NOT NULL,
    roblox_user_id TEXT NOT NULL,
    roblox_username TEXT NOT NULL,
    verified_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(guild_id, discord_user_id)
  );

  CREATE TABLE IF NOT EXISTS verify_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    question TEXT NOT NULL,
    order_num INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS exp (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    exp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    last_exp_at INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS level_roles (
    guild_id TEXT NOT NULL,
    level INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, level)
  );

  CREATE TABLE IF NOT EXISTS ping_protection (
    guild_id TEXT NOT NULL,
    protected_role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, protected_role_id)
  );

  CREATE TABLE IF NOT EXISTS ping_allowed_roles (
    guild_id TEXT NOT NULL,
    allowed_role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, allowed_role_id)
  );

  CREATE TABLE IF NOT EXISTS command_permissions (
    guild_id TEXT NOT NULL,
    command_name TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, command_name, role_id)
  );

  CREATE TABLE IF NOT EXISTS scam_domains (
    guild_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    added_by TEXT,
    added_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (guild_id, domain)
  );

  CREATE TABLE IF NOT EXISTS rank_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    roblox_group_id TEXT NOT NULL,
    current_rank_id INTEGER,
    requested_rank_id INTEGER NOT NULL,
    requested_rank_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS info_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    schedule TEXT DEFAULT 'daily',
    last_posted INTEGER,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS mod_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    action TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    target_id TEXT,
    reason TEXT,
    extra TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_stats (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    game TEXT NOT NULL,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, game)
  );

  CREATE TABLE IF NOT EXISTS active_games (
    channel_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    game_type TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS economy (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    wallet INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    daily_at INTEGER DEFAULT 0,
    daily_streak INTEGER DEFAULT 0,
    total_won INTEGER DEFAULT 0,
    total_lost INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS mog_profiles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    pet TEXT DEFAULT 'none',
    aura TEXT DEFAULT 'none',
    power TEXT DEFAULT 'none',
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS mog_inventory (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id, item_type, item_name)
  );

  CREATE TABLE IF NOT EXISTS bitlife_profiles (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    age INTEGER DEFAULT 0,
    cash INTEGER DEFAULT 0,
    health INTEGER DEFAULT 100,
    happiness INTEGER DEFAULT 75,
    intelligence INTEGER DEFAULT 50,
    career TEXT DEFAULT 'Student',
    alive INTEGER DEFAULT 1,
    last_action INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS category_permissions (
    guild_id TEXT NOT NULL,
    category TEXT NOT NULL,
    mode TEXT DEFAULT 'default',
    role_ids TEXT DEFAULT '[]',
    PRIMARY KEY (guild_id, category)
  );

  CREATE TABLE IF NOT EXISTS global_permissions (
    guild_id TEXT NOT NULL,
    user_id TEXT,
    role_id TEXT,
    created_by TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    CHECK ((user_id IS NOT NULL AND role_id IS NULL) OR (user_id IS NULL AND role_id IS NOT NULL)),
    UNIQUE (guild_id, user_id, role_id)
  );

  CREATE TABLE IF NOT EXISTS ping_allowed_users (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS ping_protected_users (
    guild_id TEXT NOT NULL,
    protected_user_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, protected_user_id)
  );

  CREATE TABLE IF NOT EXISTS polls (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL,
    ends_at INTEGER NOT NULL,
    ended INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    host_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    description TEXT DEFAULT '',
    winner_count INTEGER DEFAULT 1,
    required_role_id TEXT,
    ends_at INTEGER NOT NULL,
    ended INTEGER DEFAULT 0,
    winner_ids TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS giveaway_entries (
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (message_id, user_id)
  );
`);

// These columns were added after the original ticket schema. SQLite has no
// portable IF NOT EXISTS form for ADD COLUMN, so each migration is idempotent.
for (const statement of [
  "ALTER TABLE ticket_categories ADD COLUMN ai_enabled INTEGER DEFAULT 0",
  "ALTER TABLE ticket_categories ADD COLUMN ai_instructions TEXT DEFAULT ''",
  "ALTER TABLE economy ADD COLUMN last_steal_at INTEGER DEFAULT 0",
  "ALTER TABLE giveaways ADD COLUMN past_winner_ids TEXT DEFAULT '[]'",
]) {
  try { db.exec(statement); } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getSetting = (guildId, key, defaultValue = null) => {
  const row = db.prepare('SELECT value FROM guild_settings WHERE guild_id = ? AND key = ?').get(guildId, key);
  if (!row) return defaultValue;
  try { return JSON.parse(row.value); } catch { return row.value; }
};

const setSetting = (guildId, key, value) => {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  db.prepare('INSERT OR REPLACE INTO guild_settings (guild_id, key, value) VALUES (?, ?, ?)').run(guildId, key, serialized);
};

const deleteSetting = (guildId, key) => {
  db.prepare('DELETE FROM guild_settings WHERE guild_id = ? AND key = ?').run(guildId, key);
};

module.exports = { db, getSetting, setSetting, deleteSetting };
