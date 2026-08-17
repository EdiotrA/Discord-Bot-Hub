const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const AI = require('../../utils/ai');

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/**
 * Return a valid stored OAuth token for the user, or null if absent/expired
 * or missing the required grants. Requires exact `guilds` and `guilds.join`
 * scopes — an older/partial token must not pass, otherwise verification
 * proceeds without the permissions it needs.
 */
function getOAuthToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare(
    'SELECT * FROM discord_oauth_tokens WHERE user_id = ? AND expires_at > ?',
  ).get(userId, now) || null;
  if (!row) return null;
  const scopes = String(row.scope || '').split(/\s+/);
  if (!scopes.includes('guilds') || !scopes.includes('guilds.join')) return null;
  return row;
}

/** Fetch the list of guilds the user is in via their OAuth access token. */
async function fetchUserGuilds(accessToken) {
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Attempt to add a user to a Discord guild using their OAuth `guilds.join` token.
 * Requires the bot to already be a member of the target guild.
 */
async function autoJoinGuild(guildId, userId, accessToken, botToken) {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken }),
      },
    );
    // 201 = joined, 204 = already a member — both are success
    return res.status === 201 || res.status === 204;
  } catch {
    return false;
  }
}

// ─── Verification log ─────────────────────────────────────────────────────────

/**
 * Persist a verification attempt and (optionally) post it to the log channel.
 * status: 'success' | 'failed' | 'timeout' | 'pending'
 */
async function logVerification(interaction, description, status = 'success', robloxUsername = null) {
  // interaction.guild is null when called from a DM context — guard everywhere
  const gid = interaction.guild?.id ?? interaction.guildId;
  if (!gid) return; // no guild context at all, skip

  // Persist to DB
  try {
    db.prepare(
      `INSERT INTO verify_logs (guild_id, discord_user_id, roblox_username, status, reason)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(gid, interaction.user.id, robloxUsername, status, description);
  } catch { /* non-fatal */ }

  // Post to log channel if configured
  const channelId = getSetting(gid, 'verify_log_channel');
  if (!channelId) return;
  const guild = interaction.guild ?? interaction.client?.guilds?.cache?.get(gid);
  const channel = guild?.channels?.cache?.get(channelId);
  if (!channel) return;

  const success = status === 'success';
  const embed = success
    ? Embed.success('Verification Log', description)
    : Embed.warning('Verification Log', description);
  await channel.send({ embeds: [embed] }).catch(() => {});
}

// ─── Modal & panel ────────────────────────────────────────────────────────────

function buildVerifyModal() {
  return new ModalBuilder()
    .setCustomId('verify_modal')
    .setTitle('Roblox Verification')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('roblox_username')
        .setLabel('Your Roblox Username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('e.g. BuilderMan'),
    ));
}

// ─── Server join check ────────────────────────────────────────────────────────

/**
 * Check that the user is in all required servers.
 * With OAuth: checks via Discord API + auto-joins if possible.
 * Without OAuth: falls back to bot-member-check / button confirmation.
 *
 * Returns { ok: true } or { ok: false, pending: [invite], useOAuth: bool }
 */
async function checkJoinServers(interaction, joinServers, oauthToken) {
  const pending = [];
  const gid = interaction.guild.id;

  const userGuildIds = new Set();
  if (oauthToken) {
    const guilds = await fetchUserGuilds(oauthToken.access_token);
    for (const g of guilds) userGuildIds.add(g.id);
  }

  for (const invite of joinServers) {
    try {
      const resolved = await interaction.client.fetchInvite(invite);
      const targetGuildId = resolved.guild?.id;
      if (!targetGuildId) { pending.push(invite); continue; }

      if (oauthToken) {
        if (userGuildIds.has(targetGuildId)) continue; // already in it

        // Try auto-join if bot is in the target server and scope allows
        const hasJoinScope = oauthToken.scope?.includes('guilds.join');
        const botInGuild = interaction.client.guilds.cache.has(targetGuildId);
        if (hasJoinScope && botInGuild) {
          const joined = await autoJoinGuild(
            targetGuildId, interaction.user.id,
            oauthToken.access_token, interaction.client.token,
          );
          if (joined) continue; // success
        }
        pending.push(invite);
      } else {
        // Legacy: check if bot is in target guild and member is there
        const targetGuild = interaction.client.guilds.cache.get(targetGuildId);
        if (targetGuild) {
          const member = await targetGuild.members.fetch(interaction.user.id).catch(() => null);
          if (member) continue;
        }
        pending.push(invite);
      }
    } catch {
      pending.push(invite);
    }
  }

  return pending.length === 0
    ? { ok: true }
    : { ok: false, pending, useOAuth: !oauthToken };
}

// ─── Main modal handler ───────────────────────────────────────────────────────

async function handleVerifyModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const username = interaction.fields.getTextInputValue('roblox_username');
  const gid = interaction.guild.id;
  const userId = interaction.user.id;

  // Resolve Roblox user
  const user = await Roblox.getUserByUsername(username);
  if (!user) {
    await logVerification(interaction, `❌ <@${userId}> tried unknown Roblox username \`${username.slice(0, 60)}\`.`, 'failed', username);
    return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find Roblox user \`${username}\`. Check spelling.`)] });
  }

  // Verify code in bio
  const code = Roblox.generateVerifyCode(userId);
  const hasCode = await Roblox.checkVerifyCode(user.id, code);
  if (!hasCode) {
    return interaction.editReply({
      embeds: [Embed.warning('Add Code to Bio',
        `Add this code to your **Roblox profile bio**, then run \`/verify\` again:\n\n\`\`\`${code}\`\`\`\n> Roblox → Profile → Edit → About → paste → Save`)],
    });
  }

  // Required server joins
  const joinServers = getSetting(gid, 'verify_join_servers') || [];
  if (Array.isArray(joinServers) && joinServers.length) {
    const oauthToken = getOAuthToken(userId);

    // Token should already exist — /verify enforces authorization upfront.
    // If it's expired or missing somehow, tell them to run /verify again.
    if (!oauthToken) {
      await logVerification(interaction, `⚠️ <@${userId}> reached modal without OAuth token — sent to re-authorize.`, 'pending', user.name);
      return interaction.editReply({
        embeds: [Embed.warning(
          'Re-Authorization Required',
          'Your authorization has expired. Run `/verify` again to re-authorize Loopy, then complete verification.',
        )],
      });
    }

    // Has OAuth token — check/join guilds
    const result = await checkJoinServers(interaction, joinServers, oauthToken);
    if (!result.ok) {
      const linkButtons = result.pending.slice(0, 4).map((inv, i) =>
        new ButtonBuilder()
          .setLabel(result.pending.length === 1 ? 'Join Server' : `Join Server ${i + 1}`)
          .setStyle(ButtonStyle.Link)
          .setURL(inv),
      );
      await logVerification(interaction, `⏳ <@${userId}> (Roblox: **${user.name}**) still missing ${result.pending.length} required server(s).`, 'pending', user.name);
      return interaction.editReply({
        embeds: [Embed.warning('Still Missing Servers',
          `Please join ${result.pending.length === 1 ? 'this server' : 'these servers'} to continue:\n${result.pending.map(s => `• ${s}`).join('\n')}`)],
        components: [new ActionRowBuilder().addComponents(...linkButtons)],
      });
    }
  }

  // AI verify questions (DM flow)
  const questions = db.prepare(
    'SELECT question FROM verify_questions WHERE guild_id = ? ORDER BY order_num',
  ).all(gid).map(r => r.question);

  if (questions.length > 0) {
    const context = getSetting(gid, 'verify_context') || '';
    let dmChannel;
    try { dmChannel = await interaction.user.createDM(); } catch {
      await logVerification(interaction, `❌ <@${userId}> could not complete verification as **${user.name}** — DMs are closed.`, 'failed', user.name);
      return interaction.editReply({ embeds: [Embed.error('DMs Closed', 'Enable DMs to complete the verification questions.')] });
    }

    await interaction.editReply({ embeds: [Embed.info('Verification', 'Check your DMs to answer a few quick questions.')] });

    const answers = [];
    for (const [i, q] of questions.entries()) {
      await dmChannel.send({
        embeds: [Embed.info(`Question ${i + 1} of ${questions.length}`, q)],
      });
      try {
        const col = await dmChannel.awaitMessages({
          filter: m => m.author.id === userId,
          max: 1, time: 90_000, errors: ['time'],
        });
        answers.push(col.first().content);
      } catch {
        await dmChannel.send({ embeds: [Embed.error('Timed Out', 'Verification cancelled — you took too long to answer.')] });
        await logVerification(interaction, `❌ <@${userId}> timed out on verification questions as **${user.name}**.`, 'timeout', user.name);
        return;
      }
    }

    const aiResult = await AI.evaluateVerifyAnswers(questions, answers, context);
    if (!aiResult.approved) {
      await dmChannel.send({
        embeds: [Embed.error('Verification Failed', `Your answers didn't meet the requirements.\n**Reason:** ${aiResult.reason}`)],
      });
      await logVerification(
        interaction,
        `❌ <@${userId}> failed AI verification as **${user.name}** — ${aiResult.reason} (confidence: ${aiResult.confidence})`,
        'failed', user.name,
      );
      return;
    }
  }

  // ✅ Save verification
  db.prepare(
    `INSERT OR REPLACE INTO verifications
       (guild_id, discord_user_id, roblox_user_id, roblox_username)
     VALUES (?, ?, ?, ?)`,
  ).run(gid, userId, String(user.id), user.name);

  // Clean up pending state if any
  db.prepare('DELETE FROM verify_oauth_pending WHERE user_id = ? AND guild_id = ?').run(userId, gid);

  // Assign verified role
  const verifiedRole = getSetting(gid, 'verified_role');
  if (verifiedRole) {
    const role = interaction.guild.roles.cache.get(verifiedRole);
    if (role) await interaction.member.roles.add(role).catch(() => {});
  }

  const thumbnail = await Roblox.getUserThumbnail(user.id);
  await interaction.editReply({
    embeds: [Embed.roblox('Verified! ✅', `You are now verified as **${user.name}**.`,
      [{ name: 'Roblox ID', value: String(user.id), inline: true }], thumbnail)],
  });
  await logVerification(
    interaction,
    `✅ <@${userId}> verified as Roblox user **${user.name}** (ID: \`${user.id}\`).`,
    'success', user.name,
  );
}

// ─── OAuth Continue button ────────────────────────────────────────────────────

/**
 * User clicked "Continue Verification" after OAuth.
 * Re-check guild membership with their now-stored token and complete the flow.
 */
async function handleOAuthContinue(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;

  // Button fires from a DM — interaction.guild is null here.
  // Read guild_id from the pending record we stored when OAuth was initiated.
  const pendingRow = db.prepare(
    'SELECT * FROM verify_oauth_pending WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
  ).get(userId);

  if (!pendingRow) {
    return interaction.editReply({
      embeds: [Embed.warning('Session Expired', 'Your verification session expired. Run `/verify` in the server to start again.')],
    });
  }

  const gid = pendingRow.guild_id;

  // Fetch the guild object so we can assign roles later
  const guild = interaction.client.guilds.cache.get(gid);

  const oauthToken = getOAuthToken(userId);
  if (!oauthToken) {
    // Token still not present — resend OAuth link
    const state = Buffer.from(`${gid}:${userId}:${pendingRow.roblox_username}`, 'utf8').toString('base64url');
    const redirectBase = process.env.OAUTH_REDIRECT_URI
      ? process.env.OAUTH_REDIRECT_URI.replace('/oauth/discord/callback', '')
      : `https://${process.env.REPLIT_DEV_DOMAIN}/api`;
    const oauthUrl = `${redirectBase}/oauth/discord?state=${state}`;
    return interaction.editReply({
      embeds: [Embed.warning('Not Authorized Yet', "Loopy hasn't received your authorization yet. Click Authorize first, then come back.")],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Authorize Loopy').setStyle(ButtonStyle.Link).setURL(oauthUrl),
      )],
    });
  }

  // Check / auto-join required servers
  const joinServers = getSetting(gid, 'verify_join_servers') || [];
  if (Array.isArray(joinServers) && joinServers.length) {
    // checkJoinServers needs interaction.guild for bot-in-guild check — pass a shim
    const shimInteraction = { ...interaction, guild, client: interaction.client, user: interaction.user };
    const result = await checkJoinServers(shimInteraction, joinServers, oauthToken);
    if (!result.ok) {
      const linkButtons = result.pending.slice(0, 4).map((inv, i) =>
        new ButtonBuilder()
          .setLabel(result.pending.length === 1 ? 'Join Server' : `Join Server ${i + 1}`)
          .setStyle(ButtonStyle.Link)
          .setURL(inv),
      );
      return interaction.editReply({
        embeds: [Embed.warning('Still Missing Servers',
          `Loopy added you where it could, but you still need to manually join:\n${result.pending.map(s => `• ${s}`).join('\n')}`)],
        components: [new ActionRowBuilder().addComponents(...linkButtons)],
      });
    }
  }

  // Look up Roblox user
  const user = await Roblox.getUserByUsername(pendingRow.roblox_username);
  if (!user) {
    return interaction.editReply({
      embeds: [Embed.error('Roblox User Not Found', `Could not find **${pendingRow.roblox_username}**. Run \`/verify\` again.`)],
    });
  }

  // AI questions (if any)
  const questions = db.prepare(
    'SELECT question FROM verify_questions WHERE guild_id = ? ORDER BY order_num',
  ).all(gid).map(r => r.question);

  if (questions.length > 0) {
    const context = getSetting(gid, 'verify_context') || '';
    let dmChannel;
    try { dmChannel = await interaction.user.createDM(); } catch {
      return interaction.editReply({ embeds: [Embed.error('DMs Closed', 'Enable DMs to answer the verification questions.')] });
    }
    await interaction.editReply({ embeds: [Embed.info('Verification', 'Check your DMs to answer a few quick questions.')] });
    const answers = [];
    for (const [i, q] of questions.entries()) {
      await dmChannel.send({ embeds: [Embed.info(`Question ${i + 1} of ${questions.length}`, q)] });
      try {
        const col = await dmChannel.awaitMessages({ filter: m => m.author.id === userId, max: 1, time: 90_000, errors: ['time'] });
        answers.push(col.first().content);
      } catch {
        await dmChannel.send({ embeds: [Embed.error('Timed Out', 'Verification cancelled.')] });
        // log without guild context
        db.prepare(`INSERT INTO verify_logs (guild_id, discord_user_id, roblox_username, status, reason) VALUES (?, ?, ?, ?, ?)`)
          .run(gid, userId, user.name, 'timeout', 'Timed out on questions');
        return;
      }
    }
    const aiResult = await AI.evaluateVerifyAnswers(questions, answers, context);
    if (!aiResult.approved) {
      await dmChannel.send({ embeds: [Embed.error('Verification Failed', `**Reason:** ${aiResult.reason}`)] });
      db.prepare(`INSERT INTO verify_logs (guild_id, discord_user_id, roblox_username, status, reason) VALUES (?, ?, ?, ?, ?)`)
        .run(gid, userId, user.name, 'failed', aiResult.reason);
      return;
    }
  }

  // Save verification
  db.prepare(
    `INSERT OR REPLACE INTO verifications (guild_id, discord_user_id, roblox_user_id, roblox_username)
     VALUES (?, ?, ?, ?)`,
  ).run(gid, userId, String(user.id), user.name);
  db.prepare('DELETE FROM verify_oauth_pending WHERE user_id = ? AND guild_id = ?').run(userId, gid);

  // Assign verified role (guild may be null if bot left, so guard)
  if (guild) {
    const verifiedRoleId = getSetting(gid, 'verified_role');
    if (verifiedRoleId) {
      const role = guild.roles.cache.get(verifiedRoleId);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (role && member) await member.roles.add(role).catch(() => {});
    }
  }

  // Log
  db.prepare(`INSERT INTO verify_logs (guild_id, discord_user_id, roblox_username, status, reason) VALUES (?, ?, ?, ?, ?)`)
    .run(gid, userId, user.name, 'success', 'OAuth continue flow');

  // Post to verify log channel if configured
  const logChannelId = getSetting(gid, 'verify_log_channel');
  if (logChannelId && guild) {
    const ch = guild.channels.cache.get(logChannelId);
    if (ch) await ch.send({ embeds: [Embed.success('Verification Log', `✅ <@${userId}> verified as **${user.name}** (ID: \`${user.id}\`) via OAuth flow.`)] }).catch(() => {});
  }

  const thumbnail = await Roblox.getUserThumbnail(user.id);
  await interaction.editReply({
    embeds: [Embed.roblox('Verified! ✅', `You are now verified as **${user.name}**.`,
      [{ name: 'Roblox ID', value: String(user.id), inline: true }], thumbnail)],
  });
}

// ─── Legacy "I've Joined" button ──────────────────────────────────────────────
// Kept for servers that don't use OAuth yet.
async function handleVerifyJoined(interaction) {
  // Always start from the top — startVerification enforces the
  // authorize-first requirement and opens the modal when a token exists.
  // (handleOAuthContinue is reserved for explicit pending OAuth sessions.)
  return startVerification(interaction);
}

// ─── Build the OAuth DM / in-channel ephemeral ───────────────────────────────

function buildOAuthPrompt(gid, userId) {
  const state = Buffer.from(`${gid}:${userId}:`, 'utf8').toString('base64url');
  const redirectBase = process.env.OAUTH_REDIRECT_URI
    ? process.env.OAUTH_REDIRECT_URI.replace('/oauth/discord/callback', '')
    : `https://${process.env.REPLIT_DEV_DOMAIN}/api`;
  const oauthUrl = `${redirectBase}/oauth/discord?state=${state}`;

  const embed = Embed.roblox('Authorization Required', null, [
    {
      name: '1️⃣  Authorize Loopy',
      value: 'Click **Authorize Loopy** below — this lets Loopy see what Discord servers you\'re in and automatically join you to required ones.',
      inline: false,
    },
    {
      name: '2️⃣  Run /verify again',
      value: 'After authorizing, go back to the server and run `/verify` again to complete your verification.',
      inline: false,
    },
  ]);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Authorize Loopy')
      .setStyle(ButtonStyle.Link)
      .setEmoji('🔐')
      .setURL(oauthUrl),
  );

  return { embeds: [embed], components: [row] };
}

// ─── Shared entry point ───────────────────────────────────────────────────────
// Used by /verify, the verify panel button (verify_start), the hub button, and
// the legacy verify_joined button — EVERY way verification can start goes
// through this so the OAuth-first requirement is always enforced.

async function startVerification(interaction) {
  const gid = interaction.guildId;
  const userId = interaction.user.id;

  // Already verified?
  const existing = db.prepare(
    'SELECT roblox_username FROM verifications WHERE guild_id = ? AND discord_user_id = ?',
  ).get(gid, userId);
  if (existing) {
    return interaction.reply({
      embeds: [Embed.warning('Already Verified', `You are already verified as **${existing.roblox_username}**. Use \`/unverify\` to reset.`)],
      ephemeral: true,
    });
  }

  // If this server requires guild membership, the user MUST authorize first
  // so the bot can check and join servers on their behalf.
  const joinServers = getSetting(gid, 'verify_join_servers') || [];
  if (Array.isArray(joinServers) && joinServers.length > 0) {
    const oauthToken = getOAuthToken(userId);
    if (!oauthToken) {
      const prompt = buildOAuthPrompt(gid, userId);

      // Try to DM them — if DMs are closed, show it as ephemeral in-channel
      let dmed = false;
      try {
        const dm = await interaction.user.createDM();
        await dm.send(prompt);
        dmed = true;
      } catch { /* DMs closed */ }

      await logVerification(interaction, `⏳ <@${userId}> needs to authorize before verifying.`, 'pending');

      if (dmed) {
        return interaction.reply({
          embeds: [Embed.info(
            'Check Your DMs ✉️',
            '**You must authorize Loopy before you can verify.**\n\nA message has been sent to your DMs. Click **Authorize Loopy**, then come back and verify again.',
          )],
          ephemeral: true,
        });
      } else {
        // DMs closed — show the authorize button right here
        return interaction.reply({ ...prompt, ephemeral: true });
      }
    }
  }

  // Has token (or no join servers required) — open the Roblox username modal
  await interaction.showModal(buildVerifyModal());
}

// ─── Slash command ────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your Roblox account'),
  async execute(interaction) {
    return startVerification(interaction);
  },
  handleVerifyModal,
  handleVerifyJoined,
  handleOAuthContinue,
  buildVerifyModal,
  startVerification,
};
