/**
 * ─────────────────────────────────────────────────────────────
 *  Command Bridge — lets the owner-only admin panel run bot
 *  slash commands remotely. Localhost-only HTTP server; the
 *  API server proxies to it with a shared-secret header.
 *
 *  Discord's API cannot trigger real slash commands, so this
 *  simulates an interaction: replies are posted as normal bot
 *  messages in the chosen channel. Buttons on those messages
 *  still work (they route through interactionCreate as usual).
 * ─────────────────────────────────────────────────────────────
 */
const http = require('http');

const PORT = Number(process.env.LOOPY_BRIDGE_PORT || 4310);
const TOKEN = process.env.SESSION_SECRET;

// ─── Option parsing ─────────────────────────────────────────────────────────

/** Flatten command JSON to { subcommand, subcommandGroup, options[] } given input tokens. */
function resolveInvocation(cmdJson, input) {
  // input: e.g. "daily", "question: will it rain", "user: 123 amount: 50"
  let rest = input.trim();
  let subcommandGroup = null;
  let subcommand = null;
  let optionDefs = cmdJson.options ?? [];

  const takeToken = () => {
    const m = rest.match(/^(\S+)\s*/);
    if (!m) return null;
    return m[1];
  };

  // Subcommand group / subcommand (types 2 and 1)
  for (let depth = 0; depth < 2; depth++) {
    const hasSubs = optionDefs.some(o => o.type === 1 || o.type === 2);
    if (!hasSubs) break;
    const tok = takeToken();
    if (!tok) throw new Error(`This command needs a subcommand: ${optionDefs.filter(o => o.type === 1 || o.type === 2).map(o => o.name).join(', ')}`);
    const def = optionDefs.find(o => (o.type === 1 || o.type === 2) && o.name === tok.toLowerCase());
    if (!def) throw new Error(`Unknown subcommand \`${tok}\`. Options: ${optionDefs.filter(o => o.type === 1 || o.type === 2).map(o => o.name).join(', ')}`);
    rest = rest.slice(rest.indexOf(tok) + tok.length).trim();
    if (def.type === 2) { subcommandGroup = def.name; } else { subcommand = def.name; }
    optionDefs = def.options ?? [];
    if (def.type === 1) break;
  }

  // Parse named options: "name: value name2: value2" — names must match defs.
  const values = {};
  if (optionDefs.length && rest) {
    const names = optionDefs.map(o => o.name);
    // Build regex that finds "<name>:" boundaries
    const pattern = new RegExp(`\\b(${names.map(n => n.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\s*:`, 'gi');
    const marks = [];
    let m;
    while ((m = pattern.exec(rest)) !== null) marks.push({ name: m[1].toLowerCase(), start: m.index, valueStart: pattern.lastIndex });
    if (marks.length === 0) {
      // Single-option shorthand: whole rest is the value of the first required option
      const first = optionDefs.find(o => o.required) ?? optionDefs[0];
      if (first) values[first.name] = rest;
    } else {
      for (let i = 0; i < marks.length; i++) {
        const end = i + 1 < marks.length ? marks[i + 1].start : rest.length;
        values[marks[i].name] = rest.slice(marks[i].valueStart, end).trim();
      }
    }
  }

  // Validate required + coerce types
  const parsed = {};
  for (const def of optionDefs) {
    const raw = values[def.name];
    if (raw === undefined || raw === '') {
      if (def.required) throw new Error(`Missing required option \`${def.name}\`. Usage: ${def.name}: <value>`);
      continue;
    }
    parsed[def.name] = { def, raw };
  }
  return { subcommandGroup, subcommand, parsed };
}

const stripMention = (s) => s.replace(/^<[@#][!&]?(\d+)>$/, '$1').trim();

// ─── Mock interaction ───────────────────────────────────────────────────────

async function buildInteraction(client, { guild, channel, member, cmdName, invocation }) {
  const { subcommandGroup, subcommand, parsed } = invocation;
  const sent = []; // messages the command produced
  let replyMessage = null;
  let deferred = false;

  const getRaw = (name) => parsed[name]?.raw;

  // Pre-resolve user/member/channel/role options via fetch so the synchronous
  // option getters work even when entities aren't cached.
  const resolved = { users: {}, members: {}, channels: {}, roles: {} };
  for (const [name, { def, raw }] of Object.entries(parsed)) {
    const id = stripMention(raw);
    try {
      if (def.type === 6) { // USER
        resolved.users[name] = await client.users.fetch(id).catch(() => null);
        resolved.members[name] = await guild.members.fetch(id).catch(() => null);
      } else if (def.type === 7) { // CHANNEL — must belong to the selected guild
        const ch = await guild.channels.fetch(id).catch(() => null);
        resolved.channels[name] = ch && ch.guildId === guild.id ? ch : null;
      } else if (def.type === 8) { // ROLE
        resolved.roles[name] = await guild.roles.fetch(id).catch(() => null);
      } else if (def.type === 9) { // MENTIONABLE
        resolved.members[name] = await guild.members.fetch(id).catch(() => null);
        if (!resolved.members[name]) resolved.roles[name] = await guild.roles.fetch(id).catch(() => null);
      }
    } catch { /* leave unresolved; getter throws a friendly error */ }
  }

  const options = {
    getSubcommand: (required = true) => {
      if (!subcommand && required) throw new Error('No subcommand supplied');
      return subcommand;
    },
    getSubcommandGroup: (required = false) => subcommandGroup,
    getString: (name) => getRaw(name) ?? null,
    getInteger: (name) => {
      const r = getRaw(name); if (r == null) return null;
      const n = parseInt(r, 10);
      if (Number.isNaN(n)) throw new Error(`Option \`${name}\` must be a number`);
      return n;
    },
    getNumber: (name) => {
      const r = getRaw(name); if (r == null) return null;
      const n = Number(r);
      if (Number.isNaN(n)) throw new Error(`Option \`${name}\` must be a number`);
      return n;
    },
    getBoolean: (name) => {
      const r = getRaw(name); if (r == null) return null;
      return ['true', 'yes', '1', 'on'].includes(r.toLowerCase());
    },
    getUser: (name) => {
      const r = getRaw(name); if (r == null) return null;
      const u = resolved.users[name];
      if (!u) throw new Error(`Option \`${name}\`: couldn't find user \`${r}\` — use their ID or @mention`);
      return u;
    },
    getMember: (name) => {
      const r = getRaw(name); if (r == null) return null;
      return resolved.members[name] ?? null;
    },
    getChannel: (name) => {
      const r = getRaw(name); if (r == null) return null;
      const ch = resolved.channels[name];
      if (!ch) throw new Error(`Option \`${name}\`: couldn't find channel \`${r}\` in that server — use its ID or #mention`);
      return ch;
    },
    getRole: (name) => {
      const r = getRaw(name); if (r == null) return null;
      const role = resolved.roles[name];
      if (!role) throw new Error(`Option \`${name}\`: couldn't find role \`${r}\` — use its ID`);
      return role;
    },
    getAttachment: () => null,
    getMentionable: (name) => options.getMember(name) ?? options.getRole(name),
    getFocused: () => '',
  };

  const send = async (payload) => {
    const p = typeof payload === 'string' ? { content: payload } : { ...payload };
    delete p.ephemeral;
    delete p.flags;
    delete p.fetchReply;
    const msg = await channel.send(p);
    sent.push(msg);
    return msg;
  };

  const interaction = {
    client,
    guild,
    guildId: guild.id,
    channel,
    channelId: channel.id,
    user: member.user,
    member,
    memberPermissions: member.permissions,
    commandName: cmdName,
    options,
    createdTimestamp: Date.now(),
    id: `bridge-${Date.now()}`,
    isChatInputCommand: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isAutocomplete: () => false,
    isRepliable: () => true,
    inGuild: () => true,
    inCachedGuild: () => true,
    get replied() { return replyMessage !== null; },
    get deferred() { return deferred; },
    // Real placeholder message so commands that fetchReply() after deferring work.
    deferReply: async () => {
      deferred = true;
      replyMessage = await send({ content: '⏳ Working…' });
      return replyMessage;
    },
    reply: async (payload) => { replyMessage = await send(payload); return replyMessage; },
    editReply: async (payload) => {
      if (replyMessage) {
        const p = typeof payload === 'string' ? { content: payload } : { ...payload };
        delete p.ephemeral; delete p.flags;
        return replyMessage.edit(p);
      }
      replyMessage = await send(payload);
      return replyMessage;
    },
    followUp: (payload) => send(payload),
    deleteReply: async () => { if (replyMessage) await replyMessage.delete().catch(() => {}); replyMessage = null; },
    fetchReply: async () => replyMessage,
    showModal: async () => { throw new Error('This command opens a form (modal) — it can only be used inside Discord'); },
    awaitModalSubmit: async () => { throw new Error('This command requires a form — use it inside Discord'); },
  };

  return { interaction, sent };
}

// ─── HTTP server ────────────────────────────────────────────────────────────

async function runCommand(client, { guildId, channelId, userId, command }) {
  const raw = command.trim().replace(/^\//, '');
  const name = raw.split(/\s+/)[0]?.toLowerCase();
  if (!name) throw new Error('Empty command');
  const cmd = client.commands.get(name);
  if (!cmd) throw new Error(`Unknown command \`/${name}\``);

  const guild = await client.guilds.fetch(guildId);
  const channel = await guild.channels.fetch(channelId);
  if (!channel?.isTextBased()) throw new Error('Target channel is not a text channel');
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) throw new Error('You must be a member of that server to run commands there');

  const invocation = resolveInvocation(cmd.data.toJSON(), raw.slice(name.length));
  const { interaction, sent } = await buildInteraction(client, { guild, channel, member, cmdName: name, invocation });

  // Same permission gate as normal Discord invocations
  try {
    const { checkPermission } = require('./permissions');
    const allowed = await checkPermission(interaction, name);
    if (!allowed) throw new Error('You do not have permission to use this command in that server');
  } catch (err) {
    if (err.message.includes('permission')) throw err;
    // permissions module problem — fail open like a missing check would be wrong; fail closed
    throw new Error('Permission check failed — try again');
  }

  // Bound execution time so the bridge never hangs the panel
  await Promise.race([
    cmd.execute(interaction),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Command timed out after 30s — it may still finish in Discord')), 30_000)),
  ]);
  return { messages: sent.length };
}

function startCommandBridge(client) {
  if (!TOKEN) {
    console.warn('[Bridge] SESSION_SECRET not set — command bridge disabled');
    return;
  }
  const server = http.createServer((req, res) => {
    const json = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method !== 'POST' || (req.url !== '/run' && req.url !== '/test-welcome')) return json(404, { error: 'Not found' });
    if (req.headers['x-bridge-token'] !== TOKEN) return json(401, { error: 'Unauthorized' });

    if (req.url === '/test-welcome') {
      let tbody = '';
      req.on('data', c => { tbody += c; if (tbody.length > 10_000) { json(413, { error: 'Request too large' }); req.destroy(); } });
      req.on('end', async () => {
        try {
          const { guildId, userId } = JSON.parse(tbody || '{}');
          if (!guildId || !userId) return json(400, { error: 'guildId and userId are required' });
          const guild = await client.guilds.fetch(guildId);
          const member = await guild.members.fetch(userId);
          const handler = require('../events/guildMemberAdd');
          await handler.execute(member, client);
          return json(200, { ok: true, note: 'guildMemberAdd handler executed — check the welcome channel' });
        } catch (err) {
          console.error('[Bridge] test-welcome failed:', err.message);
          return json(422, { error: err.message });
        }
      });
      return;
    }

    let body = '';
    let tooLarge = false;
    req.on('data', c => {
      body += c;
      if (body.length > 10_000 && !tooLarge) { tooLarge = true; json(413, { error: 'Request too large' }); req.destroy(); }
    });
    req.on('end', async () => {
      if (tooLarge) return;
      try {
        const { guildId, channelId, userId, command } = JSON.parse(body || '{}');
        if (!guildId || !channelId || !userId || !command) return json(400, { error: 'guildId, channelId, userId, command are required' });
        const result = await runCommand(client, { guildId, channelId, userId, command });
        return json(200, { ok: true, ...result });
      } catch (err) {
        console.error('[Bridge] run failed:', err.message);
        return json(422, { error: err.message || 'Command failed' });
      }
    });
  });
  server.listen(PORT, '127.0.0.1', () => console.log(`[Bridge] Command bridge listening on 127.0.0.1:${PORT}`));
  server.on('error', (err) => console.error('[Bridge] server error:', err.message));
}

module.exports = { startCommandBridge };
