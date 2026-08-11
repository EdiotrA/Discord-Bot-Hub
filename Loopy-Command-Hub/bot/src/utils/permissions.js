const { PermissionFlagsBits } = require('discord.js');
const { db, getSetting } = require('../database');
const Embed = require('./embed');

/**
 * Check if a member can use a command based on:
 * 1. Discord admin bypass
 * 2. Guild owner bypass
 * 3. Command permission roles set by owner
 */
async function checkPermission(interaction, commandName) {
  const member = interaction.member;
  const guildId = interaction.guildId;

  if (!member || !guildId) return false;

  // Always allow guild owner
  if (interaction.guild.ownerId === member.id) return true;

  // Always allow Discord Administrator
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  // A user or role granted global access can use every Loopy command.
  const directGlobalGrant = db.prepare(
    'SELECT 1 AS granted FROM global_permissions WHERE guild_id = ? AND user_id = ? LIMIT 1'
  ).get(guildId, member.id);
  const globalRoleIds = db.prepare(
    'SELECT role_id FROM global_permissions WHERE guild_id = ? AND role_id IS NOT NULL'
  ).all(guildId).map(row => row.role_id);
  if (directGlobalGrant?.granted || member.roles.cache.some(role => globalRoleIds.includes(role.id))) return true;

  // Check custom command permissions
  const rows = db
    .prepare('SELECT role_id FROM command_permissions WHERE guild_id = ? AND command_name = ?')
    .all(guildId, commandName);

  if (rows.length === 0) {
    const command = interaction.client.commands.get(commandName);
    const category = command?.category || 'default';
    const categorySetting = db.prepare('SELECT mode, role_ids FROM category_permissions WHERE guild_id = ? AND category = ?').get(guildId, category);
    if (categorySetting?.mode === 'everyone') return true;
    if (categorySetting?.mode === 'roles') {
      let roleIds = [];
      try { roleIds = JSON.parse(categorySetting.role_ids || '[]'); } catch {}
      return member.roles.cache.some(r => roleIds.includes(r.id));
    }
    // Normal commands are public unless an admin has restricted their category.
    // Configuration and moderation categories remain protected by default.
    return !['admin', 'moderation', 'tickets'].includes(category);
  }

  // Check if member has any of the allowed roles
  const allowedRoleIds = rows.map(r => r.role_id);
  return member.roles.cache.some(r => allowedRoleIds.includes(r.id));
}

/**
 * Deny response helper
 */
async function deny(interaction, reason = 'You do not have permission to use this command.') {
  const embed = Embed.error('Permission Denied', reason);
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Add permission roles to a command
 */
function addPermission(guildId, commandName, roleId) {
  db.prepare('INSERT OR IGNORE INTO command_permissions (guild_id, command_name, role_id) VALUES (?, ?, ?)')
    .run(guildId, commandName, roleId);
}

/**
 * Remove permission roles from a command
 */
function removePermission(guildId, commandName, roleId) {
  db.prepare('DELETE FROM command_permissions WHERE guild_id = ? AND command_name = ? AND role_id = ?')
    .run(guildId, commandName, roleId);
}

/**
 * Get all roles that have permission for a command
 */
function getPermissions(guildId, commandName) {
  return db
    .prepare('SELECT role_id FROM command_permissions WHERE guild_id = ? AND command_name = ?')
    .all(guildId, commandName)
    .map(r => r.role_id);
}

/**
 * Get all commands a role has permission to use
 */
function getRolePermissions(guildId, roleId) {
  return db
    .prepare('SELECT command_name FROM command_permissions WHERE guild_id = ? AND role_id = ?')
    .all(guildId, roleId)
    .map(r => r.command_name);
}

/**
 * Bulk set permissions (replaces all for a command)
 */
function setPermissions(guildId, commandName, roleIds) {
  const del = db.prepare('DELETE FROM command_permissions WHERE guild_id = ? AND command_name = ?');
  const ins = db.prepare('INSERT OR IGNORE INTO command_permissions (guild_id, command_name, role_id) VALUES (?, ?, ?)');
  const trx = db.transaction(() => {
    del.run(guildId, commandName);
    for (const roleId of roleIds) ins.run(guildId, commandName, roleId);
  });
  trx();
}

function grantAll(guildId, { userId = null, roleId = null }, createdBy) {
  if (!userId && !roleId) throw new Error('A user or role is required.');
  db.prepare('INSERT OR IGNORE INTO global_permissions (guild_id, user_id, role_id, created_by) VALUES (?, ?, ?, ?)')
    .run(guildId, userId, roleId, createdBy);
}

function revokeAll(guildId, { userId = null, roleId = null }) {
  if (userId) db.prepare('DELETE FROM global_permissions WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  if (roleId) db.prepare('DELETE FROM global_permissions WHERE guild_id = ? AND role_id = ?').run(guildId, roleId);
}

function getGlobalPermissions(guildId) {
  return db.prepare('SELECT user_id, role_id, created_at FROM global_permissions WHERE guild_id = ? ORDER BY created_at').all(guildId);
}

function setCategoryPermission(guildId, category, mode, roleIds = []) {
  db.prepare('INSERT OR REPLACE INTO category_permissions (guild_id, category, mode, role_ids) VALUES (?, ?, ?, ?)')
    .run(guildId, category, mode, JSON.stringify(roleIds));
}

function getCommandNames(client) {
  return [...client.commands.keys()].sort();
}

const CATEGORY_NAMES = ['admin', 'moderation', 'tickets', 'applications', 'loa', 'roblox', 'fun', 'music', 'exp', 'utility', 'economy', 'mog', 'bitlife'];

/**
 * Check if member has a specific Discord permission
 */
function hasDiscordPermission(member, permission) {
  return member.permissions.has(permission);
}

/**
 * Check if member has any of the given roles (by ID array)
 */
function hasRole(member, roleIds) {
  if (!Array.isArray(roleIds)) roleIds = [roleIds];
  return member.roles.cache.some(r => roleIds.includes(r.id));
}

module.exports = {
  checkPermission,
  deny,
  addPermission,
  removePermission,
  getPermissions,
  getRolePermissions,
  setPermissions,
  grantAll,
  revokeAll,
  getGlobalPermissions,
  setCategoryPermission,
  getCommandNames,
  CATEGORY_NAMES,
  hasDiscordPermission,
  hasRole,
};
