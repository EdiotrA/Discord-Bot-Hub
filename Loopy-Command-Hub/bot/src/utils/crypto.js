const crypto = require('crypto');

// Symmetric encryption for at-rest storage of sensitive per-guild secrets
// (e.g. Roblox Open Cloud API keys). Uses AES-256-GCM with a key derived from
// SESSION_SECRET so ciphertext is useless without the environment secret.
//
// SESSION_SECRET is REQUIRED — we never fall back to another operational
// credential or a hard-coded literal, because that would make stored customer
// API keys decryptable by anyone with source/database access.

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required for encryption of stored secrets. Set it in the environment.');
}

const KEY = crypto.createHash('sha256').update(String(process.env.SESSION_SECRET)).digest(); // 32 bytes

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext, all base64
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

function decrypt(payload) {
  try {
    const [ivB64, tagB64, dataB64] = String(payload).split(':');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };
