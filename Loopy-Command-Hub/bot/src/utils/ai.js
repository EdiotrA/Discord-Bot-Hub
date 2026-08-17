const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5';
let client;
let remoteUnavailableUntil = 0;
let remoteErrorLogged = false;

// ---------------------------------------------------------------------------
// Profile-rating cache
// ---------------------------------------------------------------------------
// Keyed on a deterministic snapshot of the profile stats so scores are stable
// as long as the player's wins/losses/points/items haven't changed.  Any stat
// change produces a new key → cache miss → fresh AI call.
//
// A 2-hour TTL acts as a safety net for very long-lived processes; under normal
// use the key changes before the TTL ever fires.
// ---------------------------------------------------------------------------
const RATING_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const _ratingCache = new Map(); // key → { result, expiresAt }

function _profileKey(p) {
  const items = (p.items || []).slice().sort().join(',');
  return `${p.wins}:${p.losses}:${p.points}:${items}`;
}

function _cacheGet(key) {
  const entry = _ratingCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { _ratingCache.delete(key); return undefined; }
  return entry.result;
}

function _cacheSet(key, result) {
  _ratingCache.set(key, { result, expiresAt: Date.now() + RATING_CACHE_TTL_MS });
}

/** Evict all expired entries (called before writes to keep memory tidy). */
function _cacheEvict() {
  const now = Date.now();
  for (const [k, v] of _ratingCache) if (now > v.expiresAt) _ratingCache.delete(k);
}

const localResponses = {
  music: 'Join a voice channel first, then use `/play query: song name or YouTube URL`. If Loopy joins but stays silent, make sure it has **Connect** and **Speak** permission in that voice channel and is not server-muted. Use `/queue`, `/skip`, `/pause`, `/resume`, or `/stop` to control playback.',
  setup: 'Start with `/setup` for server configuration. Then use `/panel` to post the click-ready member hub. Protection commands include `/antiraid`, `/pingprotect`, `/pingstop`, `/antilink`, and `/antiscam`.',
  ticket: 'Use the ticket panel or `/ticket` to open support. Admins can configure it with `/ticketsetup`; support roles can be selected there. I can collect details, but I never pretend to perform staff actions.',
  protection: 'Use `/antiraid` for raid controls, `/pingprotect` or `/pingstop` for unauthorized mentions, `/antilink` for link rules, and `/antiscam` for scam detection. Use `/permission` to restrict commands by Admin, role, or user.',
  roblox: 'Use `/verifypanel` for the one-click Roblox flow, then `/groupinfo`, `/rankbind`, `/rankrequest`, or `/syncranks` for group tools. Discord and Roblox require the member or group owner to approve access; Loopy cannot silently join groups or servers.',
  coding: 'For coding help, send the language, exact error, expected result, and the smallest relevant code sample. I can explain the cause, propose a fix, and give you a test checklist.',
  ui: 'For UI help, tell me the screen, audience, primary action, and visual direction. I can suggest hierarchy, layout, responsive behavior, and polished empty/loading/error states.',
  help: 'I can help with `/setup`, `/panel`, `/ticketsetup`, `/verifypanel`, `/play`, `/economy`, `/mog`, protection, Roblox verification, coding, UI ideas, and debugging. Tell me what you want to do.',
};

const localRoasts = [
  'Your code has the confidence of production and the testing history of a group project.',
  'You bring main-character energy to a bug report that says "it just doesn\'t work."',
  'Your tabs have formed a committee and voted to keep the answer hidden.',
  'That was a bold choice—the kind that creates a new warning in the logs.',
  'Your server has more channels than your code has comments, and both are hard to navigate.',
];

const localCompliments = [
  'You have excellent instincts—your question gets straight to the part that matters.',
  'That is a strong idea. With a little structure, it could become a genuinely polished feature.',
  'You communicate the goal clearly, which makes solving the problem much easier.',
  'You spotted an important edge case. That kind of attention makes software reliable.',
  'That is a creative direction with a lot of room to become memorable.',
];

function pick(items, seed = '') {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return items[hash % items.length];
}

function localAssistant(prompt, context = '') {
  const text = String(prompt || '').trim();
  const normalized = text.toLowerCase();
  if (!text) return "Tell me what you need help with and I'll do my best.";
  if (/^(hi|hey|hello|yo|sup)\b/.test(normalized)) return "Hey! I'm Loopy. Ask me about the server, music, tickets, coding, UI ideas, or debugging.";
  if (/music|song|youtube|voice|playback|silent|audio/.test(normalized)) return localResponses.music;
  if (/setup|configure|dashboard|server settings/.test(normalized)) return localResponses.setup;
  if (/ticket|support|helper/.test(normalized)) return localResponses.ticket;
  if (/raid|bad.?word|profan|ping|anti.?link|scam|protect/.test(normalized)) return localResponses.protection;
  if (/roblox|verify|verification|group|rank/.test(normalized)) return localResponses.roblox;
  if (/code|coding|javascript|typescript|python|css|html|error|exception|stack trace|debug/.test(normalized)) return localResponses.coding;
  if (/ui|design|layout|button|dashboard|embed|visual/.test(normalized)) return localResponses.ui;
  if (/help|command|what can you do|how do i/.test(normalized)) return localResponses.help;
  if (context && /same|that|it|this/.test(normalized)) {
    return `I'm using the recent conversation as context. Start by sharing the exact result you want, then the command or error involved.\n\n**Recent context:** ${context.slice(-240)}`;
  }
  return `I'm Loopy's assistant — I can help with server setup, music, tickets, protection, Roblox verification, coding, UI ideas, and debugging. For "${text.slice(0, 160)}", tell me the outcome you want and I'll break it into steps.`;
}

function getClient() {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey || Date.now() < remoteUnavailableUntil) return null;
  if (!client) {
    client = new Anthropic({
      apiKey,
      ...(process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
        ? { baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL }
        : {}),
    });
  }
  return client;
}

/**
 * Extract a JSON object/array from a string that may contain prose or fences.
 */
function extractJson(text) {
  if (!text) return null;
  // Strip code fences
  const stripped = text.replace(/```json?|```/g, '').trim();
  // Try direct parse first
  try { return JSON.parse(stripped); } catch { /* fall through */ }
  // Find first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return null;
}

/**
 * Send a message to Claude and get a response.
 */
async function ask(prompt, systemPrompt = null, maxTokens = 1024) {
  try {
    const anthropic = getClient();
    if (!anthropic) return null;
    const messages = [{ role: 'user', content: prompt }];
    const params = { model: MODEL, max_tokens: maxTokens, messages };
    if (systemPrompt) params.system = systemPrompt;
    const response = await anthropic.messages.create(params);
    // Reset error state on success
    remoteUnavailableUntil = 0;
    remoteErrorLogged = false;
    return response.content[0]?.text || 'No response generated.';
  } catch (err) {
    if (!remoteErrorLogged) {
      console.error('[AI] Remote provider unavailable; using local AI:', err.message);
      remoteErrorLogged = true;
    }
    // 2-minute cooldown instead of 10 — recovers faster after transient errors
    remoteUnavailableUntil = Date.now() + 2 * 60 * 1000;
    return null;
  }
}

/**
 * Evaluate verify answers against owner-defined questions and context.
 * Returns { approved, reason, confidence }.
 * When AI is unavailable, skips evaluation and approves (logs the skip).
 */
async function evaluateVerifyAnswers(questions, answers, context = '') {
  const qa = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || 'No answer'}`).join('\n\n');
  const prompt = `${context ? `Server context: ${context}\n\n` : ''}A user is applying to join a Discord server. Evaluate their verification answers:\n\n${qa}\n\nDetermine if they should be approved. Respond with ONLY a JSON object: {"approved":true,"reason":"brief reason","confidence":"high|medium|low"}`;

  const result = await ask(prompt);
  if (!result) {
    // AI unavailable — skip AI evaluation rather than blocking all verifications
    console.warn('[AI] evaluateVerifyAnswers: AI unavailable, skipping evaluation (approving).');
    return { approved: true, reason: 'AI evaluation skipped (service unavailable)', confidence: 'low' };
  }

  const parsed = extractJson(result);
  if (!parsed || typeof parsed.approved !== 'boolean') {
    // Malformed response — log and approve rather than silently blocking
    console.warn('[AI] evaluateVerifyAnswers: Could not parse AI response, approving.\nRaw:', result.slice(0, 200));
    return { approved: true, reason: 'AI response could not be parsed', confidence: 'low' };
  }
  return parsed;
}

/**
 * Rate two Mog profiles before a challenge.
 * Each profile: { name, wins, losses, points, items: [labels] }.
 * Returns { challenger: {score, verdict}, target: {score, verdict} } or null when AI
 * is unavailable/unparseable (caller falls back to the statistical formula).
 *
 * Results are cached by profile snapshot so repeated calls with identical
 * stats return the same scores without hitting the AI again.
 */
async function rateMogProfiles(challenger, target) {
  // Cache key covers both profiles (order-sensitive: A vs B ≠ B vs A).
  const cacheKey = `pair:${_profileKey(challenger)}||${_profileKey(target)}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) {
    console.log('[AI] rateMogProfiles: cache hit, returning stable scores.');
    return cached;
  }

  const describe = (p) => {
    const total = p.wins + p.losses;
    const winRate = total > 0 ? `${Math.round((p.wins / total) * 100)}%` : 'no matches yet';
    return `Name: ${p.name}\nRecord: ${p.wins}W/${p.losses}L (win rate: ${winRate}, ${total} total matches)\nPoints: ${p.points}\nEquipped items: ${p.items.length ? p.items.join(', ') : 'none'}`;
  };
  const prompt = `You are judging a "Mog" face-off between two Discord users. Rate each player's profile from 0-100 based on: win rate (most important), total matches played (experience), equipped items (each adds power), and points tier (momentum).\n\nPlayer A:\n${describe(challenger)}\n\nPlayer B:\n${describe(target)}\n\nRespond with ONLY a JSON object: {"a":{"score":0-100,"verdict":"one short line"},"b":{"score":0-100,"verdict":"one short line"}}`;

  const result = await ask(prompt, null, 300);
  if (!result) {
    console.warn('[AI] rateMogProfiles: AI unavailable, falling back to statistical formula.');
    _cacheEvict();
    _cacheSet(cacheKey, null); // cache the null so we don't hammer AI while it's down
    return null;
  }
  const parsed = extractJson(result);
  const valid = (r) => r && typeof r.score === 'number' && r.score >= 0 && r.score <= 100;
  if (!parsed || !valid(parsed.a) || !valid(parsed.b)) {
    console.warn('[AI] rateMogProfiles: Could not parse AI response, falling back.\nRaw:', String(result).slice(0, 200));
    return null;
  }
  const rating = {
    challenger: { score: Math.round(parsed.a.score), verdict: String(parsed.a.verdict || '').slice(0, 200) },
    target:     { score: Math.round(parsed.b.score), verdict: String(parsed.b.verdict || '').slice(0, 200) },
  };
  _cacheEvict();
  _cacheSet(cacheKey, rating);
  return rating;
}

/**
 * Rate a single Mog profile.
 * Profile: { name, wins, losses, points, items: [labels] }.
 * Returns { score, verdict } or null when AI is unavailable/unparseable.
 *
 * Results are cached by profile snapshot (wins/losses/points/items) so the
 * same player always receives the same score until their stats actually change.
 */
async function rateSingleProfile(profile) {
  const cacheKey = `single:${_profileKey(profile)}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) {
    console.log('[AI] rateSingleProfile: cache hit, returning stable score.');
    return cached;
  }

  const total = profile.wins + profile.losses;
  const winRate = total > 0 ? `${Math.round((profile.wins / total) * 100)}%` : 'no matches yet';
  const description = `Name: ${profile.name}\nRecord: ${profile.wins}W/${profile.losses}L (win rate: ${winRate}, ${total} total matches)\nPoints: ${profile.points}\nEquipped items: ${profile.items.length ? profile.items.join(', ') : 'none'}`;

  const prompt = `You are judging a "Mog" Discord player profile. Rate this player from 0-100 based on: win rate (most important), total matches played (experience), equipped items (each adds power), and points tier (momentum).\n\n${description}\n\nRespond with ONLY a JSON object: {"score":0-100,"verdict":"one short line summing up this player's mog potential"}`;

  const result = await ask(prompt, null, 150);
  if (!result) {
    console.warn('[AI] rateSingleProfile: AI unavailable.');
    _cacheEvict();
    _cacheSet(cacheKey, null); // cache null briefly so we don't hammer AI while it's down
    return null;
  }
  const parsed = extractJson(result);
  if (!parsed || typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 100) {
    console.warn('[AI] rateSingleProfile: Could not parse AI response.\nRaw:', String(result).slice(0, 200));
    return null;
  }
  const rating = { score: Math.round(parsed.score), verdict: String(parsed.verdict || '').slice(0, 200) };
  _cacheEvict();
  _cacheSet(cacheKey, rating);
  return rating;
}

/**
 * Read rules from a channel and determine punishment for a violation.
 */
async function evaluateRuleViolation(rulesText, violationDescription) {
  const prompt = `Here are the server rules:\n\n${rulesText}\n\nA user has committed this violation: "${violationDescription}"\n\nBased on the rules, what should the punishment be? Respond with ONLY a JSON object: {"action":"warn|mute|kick|ban","duration":"Xm/Xh/Xd or null","reason":"brief reason"}`;
  const result = await ask(prompt);
  if (!result) return { action: 'warn', duration: null, reason: 'Rule violation' };
  const parsed = extractJson(result);
  return parsed || { action: 'warn', duration: null, reason: 'Rule violation' };
}

/**
 * Generate a concise update for an info channel.
 */
async function generateInfo(topic, guildContext = '') {
  const remote = await ask(
    `Write a concise, friendly server update about "${topic}" for a Discord info channel.${guildContext ? `\n\nServer context: ${guildContext}` : ''}\n\nKeep it under 900 characters, use Discord Markdown, no @everyone/@here.`,
  );
  return remote || localAssistant(`Give a concise server update about ${topic}`, guildContext);
}

/**
 * Generate a roast or compliment for fun commands.
 */
async function generateRoast(username) {
  const remote = await ask(
    `Write one short, playful, PG-13 roast aimed at a Discord user named "${username}". Be witty and creative, never cruel, no slurs, no references to protected traits, under 200 characters. Vary style each time (seed: ${Date.now() % 100000}). Respond with the roast only.`,
  );
  return remote ? remote.trim() : `${username}, ${pick(localRoasts, username + Date.now())}`;
}

async function generateCompliment(username) {
  const remote = await ask(
    `Write one short, genuine, creative compliment for a Discord user named "${username}". Warm but not cheesy, under 200 characters. Vary style each time (seed: ${Date.now() % 100000}). Respond with the compliment only.`,
  );
  return remote ? remote.trim() : `${username}, ${pick(localCompliments, username + Date.now())}`;
}

/**
 * Answer a question about a server (info lookup).
 */
async function answerQuestion(question, context) {
  const remote = await ask(
    question,
    `You are Loopy, a helpful Discord server assistant. Answer the member's question clearly and concisely using the provided server context when relevant. Never claim to have performed staff actions. Never use @everyone or @here. Keep replies under 1,500 characters, Discord Markdown.${context ? `\n\nServer context:\n${context}` : ''}`,
  );
  return remote || localAssistant(question, context);
}

/**
 * Read background check data and summarize.
 */
async function summarizeBackgroundCheck(data) {
  const prompt = `Summarize this Discord/Roblox user background check data in a professional, concise format for a moderator:\n\n${JSON.stringify(data, null, 2)}\n\nHighlight any red flags. Keep under 300 words.`;
  return await ask(prompt, null, 500);
}

/**
 * Respond to a ticket using the owner-provided natural-language instructions.
 */
async function answerTicket(instructions, category, transcript) {
  const remote = await ask(
    `Ticket category: ${category}\n\nConversation so far:\n${transcript}`,
    `You are Loopy, a support assistant inside a Discord ticket. Follow these owner instructions:\n${instructions || 'Help the member describe their issue clearly so staff can resolve it.'}\n\nYou can only reply with text — never claim to have performed refunds, bans, role changes, or any staff action. If the issue needs a human, say staff will follow up. Keep replies under 1,200 characters, Discord Markdown, no @everyone/@here.`,
  );
  return remote || `Thanks for reaching out about **${category}**. Please include what happened, what you expected, and any relevant screenshots or error text so staff can help quickly.`;
}

/**
 * General assistant for members who mention Loopy.
 */
async function answerAssistant(prompt, context = '') {
  const systemPrompt = `You are Loopy, a helpful Discord assistant.
Answer clearly and practically. You may help with coding, UI ideas, debugging,
and general server questions. Never claim to have changed code, joined a server,
granted permissions, or taken a moderation action. Never use @everyone or @here.
Keep replies under 1,500 characters and use Discord-friendly Markdown.
${context ? `Useful recent context:\n${context}` : ''}`;
  const remote = await ask(prompt, systemPrompt);
  return remote || localAssistant(prompt, context);
}

module.exports = {
  ask,
  evaluateRuleViolation,
  rateMogProfiles,
  rateSingleProfile,
  generateInfo,
  evaluateVerifyAnswers,
  generateRoast,
  generateCompliment,
  answerQuestion,
  summarizeBackgroundCheck,
  answerTicket,
  answerAssistant,
};
