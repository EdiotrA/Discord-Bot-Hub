const {
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const AI = require('../../utils/ai');

// ─── OAuth helpers ────────────────────────────────────────────────────────────

/** Return a valid stored OAuth token for the user, or null if absent/expired. */
function getOAuthToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(
    'SELECT * FROM discord_oauth_tokens WHERE user_id = ? AND expires_at > ?',
  ).get(userId, now) || null;
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
  // Persist to DB
  try {
    db.prepare(
      `INSERT INTO verify_logs (guild_id, discord_user_id, roblox_username, status, reason)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(interaction.guild.id, interaction.user.id, robloxUsername, status, description);
  } catch { /* non-fatal */ }

  // Post to log channel if configured
  const channelId = getSetting(interaction.guild.id, 'verify_log_channel');
  if (!channelId) return;
  const channel = interaction.guild.channels.cache.get(channelId);
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

    if (!oauthToken) {
      // No OAuth token — request authorization via DM
      const state = Buffer.from(`${gid}:${userId}:${username}`, 'utf8').toString('base64url');
      const devDomain = process.env.REPLIT_DEV_DOMAIN;
      const oauthUrl = `https://${devDomain}/api/oauth/discord?state=${state}`;

      // Save pending state so we can resume after OAuth
      db.prepare(
        `INSERT OR REPLACE INTO verify_oauth_pending (user_id, guild_id, roblox_username)
         VALUES (?, ?, ?)`,
      ).run(userId, gid, username);

      let dmChannel;
      try { dmChannel = await interaction.user.createDM(); } catch {
        return interaction.editReply({ embeds: [Embed.error('DMs Closed', 'Enable DMs so Loopy can guide you through the authorization step.')] });
      }

      await dmChannel.send({
        embeds: [Embed.roblox('One More Step', null, [
          { name: '1. Authorize Loopy', value: 'Click **Authorize** — it lets Loopy check what Discord servers you\'re in and join required ones for you automatically.', inline: false },
          { name: '2. Continue', value: 'After authorizing, click **Continue Verification** below.', inline: false },
        ])],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Authorize Loopy')
            .setStyle(ButtonStyle.Link)
            .setEmoji('🔐')
            .setURL(oauthUrl),
          new ButtonBuilder()
            .setCustomId('verify_oauth_continue')
            .setLabel('Continue Verification')
            .setStyle(ButtonStyle.Success)
            .setEmoji('▶️'),
        )],
      });

      await logVerification(interaction, `⏳ <@${userId}> (Roblox: **${user.name}**) was sent OAuth authorization link.`, 'pending', user.name);
      return interaction.editReply({
        embeds: [Embed.info('Check Your DMs', 'A message was sent to your DMs. Authorize Loopy, then click **Continue Verification**.')],
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
  const gid = interaction.guild.id;

  // Retrieve pending state
  const pending = db.prepare(
    'SELECT * FROM verify_oauth_pending WHERE user_id = ? AND guild_id = ?',
  ).get(userId, gid);

  if (!pending) {
    return interaction.editReply({
      embeds: [Embed.warning('Session Expired', 'Your verification session expired. Run `/verify` to start again.')],
    });
  }

  const oauthToken = getOAuthToken(userId);
  if (!oauthToken) {
    // Token still not present — resend OAuth link
    const state = Buffer.from(`${gid}:${userId}:${pending.roblox_username}`, 'utf8').toString('base64url');
    const oauthUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/api/oauth/discord?state=${state}`;
    return interaction.editReply({
      embeds: [Embed.warning('Not Authorized Yet', 'Loopy hasn\'t received your authorization yet. Click Authorize first, then come back.')],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Authorize Loopy').setStyle(ButtonStyle.Link).setURL(oauthUrl),
      )],
    });
  }

  // Re-resolve user for safety
  const joinServers = getSetting(gid, 'verify_join_servers') || [];
  if (Array.isArray(joinServers) && joinServers.length) {
    const result = await checkJoinServers(interaction, joinServers, oauthToken);
    if (!result.ok) {
      const linkButtons = result.pending.slice(0, 4).map((inv, i) =>
        new ButtonBuilder()
          .setLabel(result.pending.length === 1 ? 'Join Server' : `Join Server ${i + 1}`)
          .setStyle(ButtonStyle.Link)
          .setURL(inv),
      );
      return interaction.editReply({
        embeds: [Embed.warning('Still Missing Servers',
          `Loopy added you where it could, but you need to manually join:\n${result.pending.map(s => `• ${s}`).join('\n')}`)],
        components: [new ActionRowBuilder().addComponents(...linkButtons)],
      });
    }
  }

  // All servers joined — re-run verify from the username step
  // Construct a synthetic "interaction" isn't possible cleanly, so re-verify directly.
  const user = await Roblox.getUserByUsername(pending.roblox_username);
  if (!user) {
    return interaction.editReply({
      embeds: [Embed.error('Roblox User Not Found', `Could not find **${pending.roblox_username}**. Run \`/verify\` again.`)],
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
        await logVerification(interaction, `❌ <@${userId}> timed out on verification questions as **${user.name}**.`, 'timeout', user.name);
        return;
      }
    }
    const aiResult = await AI.evaluateVerifyAnswers(questions, answers, context);
    if (!aiResult.approved) {
      await dmChannel.send({ embeds: [Embed.error('Verification Failed', `**Reason:** ${aiResult.reason}`)] });
      await logVerification(interaction, `❌ <@${userId}> failed AI verification as **${user.name}** — ${aiResult.reason}`, 'failed', user.name);
      return;
    }
  }

  // Save
  db.prepare(
    `INSERT OR REPLACE INTO verifications (guild_id, discord_user_id, roblox_user_id, roblox_username)
     VALUES (?, ?, ?, ?)`,
  ).run(gid, userId, String(user.id), user.name);
  db.prepare('DELETE FROM verify_oauth_pending WHERE user_id = ? AND guild_id = ?').run(userId, gid);

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
  await logVerification(interaction, `✅ <@${userId}> verified as **${user.name}** (ID: \`${user.id}\`).`, 'success', user.name);
}

// ─── Legacy "I've Joined" button ──────────────────────────────────────────────
// Kept for servers that don't use OAuth yet.
async function handleVerifyJoined(interaction) {
  // Treat as oauth-continue if they have a token; otherwise show modal
  const oauthToken = getOAuthToken(interaction.user.id);
  if (oauthToken) return handleOAuthContinue(interaction);
  return interaction.showModal(buildVerifyModal());
}

// ─── Slash command ────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your Roblox account'),
  async execute(interaction) {
    const existing = db.prepare(
      'SELECT roblox_username FROM verifications WHERE guild_id = ? AND discord_user_id = ?',
    ).get(interaction.guildId, interaction.user.id);
    if (existing) {
      return interaction.reply({
        embeds: [Embed.warning('Already Verified', `You are already verified as **${existing.roblox_username}**. Use \`/unverify\` to reset.`)],
        ephemeral: true,
      });
    }
    await interaction.showModal(buildVerifyModal());
  },
  handleVerifyModal,
  handleVerifyJoined,
  handleOAuthContinue,
  buildVerifyModal,
};
