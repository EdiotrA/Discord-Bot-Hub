const { db, getSetting } = require('../database');
const config = require('../config');

// Known scam patterns
const SCAM_PATTERNS = [
  /discord\.gift\/[a-zA-Z0-9]+/i,
  /free\s*nitro/i,
  /steam\s*gift/i,
  /you\s*won/i,
  /claim\s*your\s*(prize|reward|nitro)/i,
  /bit\.ly\/[a-zA-Z0-9]+/i,
  /tinyurl\.com\/[a-zA-Z0-9]+/i,
  /free\s*robux/i,
  /get\s*free\s*discord/i,
  /airdrop/i,
];

const SUSPICIOUS_DOMAIN_PATTERNS = [
  /discordapp\.com\.[a-z]{2,}/i,
  /discord\.com\.[a-z]{2,}/i,
  /steamcommunity\.[^c][a-z]+/i,
  /nitro.*discord/i,
  /discord.*nitro/i,
];

/**
 * Extract all URLs from a message
 */
function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  return text.match(urlRegex) || [];
}

/**
 * Extract domain from URL
 */
function getDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Check if a message contains scam content
 */
function isScam(message, guildId = null) {
  const content = message.content || message;
  const lower = content.toLowerCase();

  // Check pattern matches
  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(lower)) return { detected: true, reason: `Suspicious pattern detected`, pattern: pattern.toString() };
  }

  // Check URLs
  const urls = extractUrls(content);
  for (const url of urls) {
    const domain = getDomain(url);

    // Check global scam domains
    for (const scamDomain of config.scamDomains) {
      if (domain.includes(scamDomain)) return { detected: true, reason: `Known scam domain: ${domain}` };
    }

    // Check suspicious domain patterns
    for (const pattern of SUSPICIOUS_DOMAIN_PATTERNS) {
      if (pattern.test(url)) return { detected: true, reason: `Suspicious URL pattern: ${domain}` };
    }

    // Check guild-specific blacklisted domains
    if (guildId) {
      const custom = db
        .prepare('SELECT domain FROM scam_domains WHERE guild_id = ? AND ? LIKE \'%\' || domain || \'%\'')
        .get(guildId, domain);
      if (custom) return { detected: true, reason: `Blacklisted domain: ${custom.domain}` };
    }
  }

  return { detected: false };
}

/**
 * Check if anti-scam is enabled for a guild
 */
function isEnabled(guildId) {
  const setting = getSetting(guildId, 'antiscam_enabled');
  return setting !== false && setting !== 'false' && setting !== '0';
}

/**
 * Add a domain to guild blacklist
 */
function addDomain(guildId, domain, addedBy) {
  const clean = domain.toLowerCase().replace(/^www\./, '').replace(/https?:\/\//i, '').split('/')[0];
  db.prepare('INSERT OR IGNORE INTO scam_domains (guild_id, domain, added_by) VALUES (?, ?, ?)').run(guildId, clean, addedBy);
  return clean;
}

/**
 * Remove a domain from guild blacklist
 */
function removeDomain(guildId, domain) {
  const clean = domain.toLowerCase().replace(/^www\./, '').replace(/https?:\/\//i, '').split('/')[0];
  db.prepare('DELETE FROM scam_domains WHERE guild_id = ? AND domain = ?').run(guildId, clean);
  return clean;
}

/**
 * Get all custom blacklisted domains for a guild
 */
function getDomains(guildId) {
  return db.prepare('SELECT domain, added_by, added_at FROM scam_domains WHERE guild_id = ?').all(guildId);
}

module.exports = { isScam, isEnabled, addDomain, removeDomain, getDomains, extractUrls };
