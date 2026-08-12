const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5'; // Fast model for bot responses
let client;
let remoteUnavailableUntil = 0;
let remoteErrorLogged = false;

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
  'You bring main-character energy to a bug report that says “it just doesn’t work.”',
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
  if (!text) return 'Tell me what you need help with and I’ll do my best.';
  if (/^(hi|hey|hello|yo|sup)\b/.test(normalized)) return 'Hey! I’m Loopy. Ask me about the server, music, tickets, coding, UI ideas, or debugging.';
  if (/music|song|youtube|voice|playback|silent|audio/.test(normalized)) return localResponses.music;
  if (/setup|configure|dashboard|server settings/.test(normalized)) return localResponses.setup;
  if (/ticket|support|helper/.test(normalized)) return localResponses.ticket;
  if (/raid|bad.?word|profan|ping|anti.?link|scam|protect/.test(normalized)) return localResponses.protection;
  if (/roblox|verify|verification|group|rank/.test(normalized)) return localResponses.roblox;
  if (/code|coding|javascript|typescript|python|css|html|error|exception|stack trace|debug/.test(normalized)) return localResponses.coding;
  if (/ui|design|layout|button|dashboard|embed|visual/.test(normalized)) return localResponses.ui;
  if (/help|command|what can you do|how do i/.test(normalized)) return localResponses.help;
  if (context && /same|that|it|this/.test(normalized)) {
    return `I’m using the recent conversation as context. Start by sharing the exact result you want, then the command or error involved.\n\n**Recent context:** ${context.slice(-240)}`;
  }
  return `I’m Loopy’s local assistant, so I can help with server setup, music, tickets, protection, Roblox verification, coding, UI ideas, and debugging. For “${text.slice(0, 160)}”, tell me the outcome you want and I’ll break it into steps.`;
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
 * Send a message to Claude and get a response
 */
async function ask(prompt, systemPrompt = null, maxTokens = 1024) {
  try {
    const anthropic = getClient();
    if (!anthropic) return null;
    const messages = [{ role: 'user', content: prompt }];
    const params = { model: MODEL, max_tokens: maxTokens, messages };
    if (systemPrompt) params.system = systemPrompt;
    const response = await anthropic.messages.create(params);
    return response.content[0]?.text || 'No response generated.';
  } catch (err) {
    if (!remoteErrorLogged) {
      console.error('[AI] Remote provider unavailable; using Loopy local AI:', err.message);
      remoteErrorLogged = true;
    }
    remoteUnavailableUntil = Date.now() + 10 * 60 * 1000;
    return null;
  }
}

/**
 * Read rules from a channel and determine punishment for a violation
 */
async function evaluateRuleViolation(rulesText, violationDescription) {
  const prompt = `Here are the server rules:\n\n${rulesText}\n\nA user has committed this violation: "${violationDescription}"\n\nBased on the rules, what should the punishment be? Respond with a JSON object: {"action":"warn|mute|kick|ban","duration":"Xm/Xh/Xd or null","reason":"brief reason"}.  Only respond with the JSON, nothing else.`;
  const result = await ask(prompt);
  if (!result) return { action: 'warn', duration: null, reason: 'Rule violation' };
  try {
    return JSON.parse(result.replace(/```json?|```/g, '').trim());
  } catch {
    return { action: 'warn', duration: null, reason: 'Rule violation' };
  }
}

/**
 * Read and summarize info for a topic (used by info channels)
 */
async function generateInfo(topic, guildContext = '') {
  return localAssistant(`Give a concise server update about ${topic}`, guildContext);
}

/**
 * Evaluate verify answers against owner-defined questions and context
 */
async function evaluateVerifyAnswers(questions, answers, context = '') {
  const qa = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || 'No answer'}`).join('\n\n');
  const prompt = `${context ? `Server context: ${context}\n\n` : ''}A user is applying to be verified in a Discord server. Evaluate their answers:\n\n${qa}\n\nDetermine if they should be verified. Respond with JSON: {"approved":true/false,"reason":"brief reason","confidence":"high|medium|low"}. Only respond with JSON.`;
  const result = await ask(prompt);
  if (!result) return { approved: false, reason: 'Could not evaluate', confidence: 'low' };
  try {
    return JSON.parse(result.replace(/```json?|```/g, '').trim());
  } catch {
    return { approved: false, reason: 'Could not evaluate answers', confidence: 'low' };
  }
}

/**
 * Generate a roast or compliment for fun commands
 */
async function generateRoast(username) {
  return `${username}, ${pick(localRoasts, username)}`;
}

async function generateCompliment(username) {
  return `${username}, ${pick(localCompliments, username)}`;
}

/**
 * Answer a question about a server (info lookup)
 */
async function answerQuestion(question, context) {
  return localAssistant(question, context);
}

/**
 * Read background check data and summarize
 */
async function summarizeBackgroundCheck(data) {
  const prompt = `Summarize this Discord/Roblox user background check data in a professional, concise format for a moderator:\n\n${JSON.stringify(data, null, 2)}\n\nHighlight any red flags. Keep under 300 words.`;
  return await ask(prompt, null, 500);
}

/**
 * Respond to a ticket using the owner-provided natural-language instructions.
 * This is intentionally response-only: Claude cannot execute Discord actions.
 */
async function answerTicket(instructions, category, transcript) {
  return `Thanks for reaching out about **${category}**. I’m Loopy’s local helper, so I can collect the details for staff. Please include what happened, what you expected, and any relevant screenshots or error text.`;
}

/**
 * General assistant for members who mention Loopy. It can explain code,
 * suggest UI improvements, and answer server questions without claiming
 * that it changed files or performed a staff action.
 */
async function answerAssistant(prompt, context = '') {
  const systemPrompt = `You are Loopy, a helpful Discord assistant.
Answer clearly and practically. You may help with coding, UI ideas, debugging,
and general server questions. Never claim to have changed code, joined a server,
granted permissions, or taken a moderation action. Never use @everyone or @here.
Keep replies under 1,500 characters and use Discord-friendly Markdown.
${context ? `Useful recent context:\n${context}` : ''}`;
  return localAssistant(prompt, context);
}

module.exports = {
  ask,
  evaluateRuleViolation,
  generateInfo,
  evaluateVerifyAnswers,
  generateRoast,
  generateCompliment,
  answerQuestion,
  summarizeBackgroundCheck,
  answerTicket,
  answerAssistant,
};
