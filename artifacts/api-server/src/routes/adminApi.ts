import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, inviteTargetsTable } from "@workspace/db";
import { requireAdmin, type AuthedRequest } from "../lib/adminAuth";
import {
  getBotGuilds,
  getBotUser,
  leaveGuild,
  guildIconUrl,
  userAvatarUrl,
  getGuildMembers,
  kickMember,
  getGuildChannels,
  deleteChannel,
  getGlobalCommands,
  getApplicationId,
  channelTypeName,
  sendChannelMessage,
} from "../lib/discordApi";
import { logger } from "../lib/logger";

const router = Router();

// ─── Guild list cache (60s) ────────────────────────────────────────────────
let guildCache: { data: Awaited<ReturnType<typeof getBotGuilds>>; ts: number } | null = null;
const GUILD_CACHE_TTL = 60_000;

async function cachedGuilds() {
  if (guildCache && Date.now() - guildCache.ts < GUILD_CACHE_TTL) return guildCache.data;
  const data = await getBotGuilds();
  guildCache = { data, ts: Date.now() };
  return data;
}

function buildInviteUrl(guildId: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&guild_id=${guildId}&scope=bot+applications.commands&permissions=8`;
}

const START_TIME = Date.now();

// ─── /admin/me ────────────────────────────────────────────────────────────
router.get("/admin/me", requireAdmin, (req: Request, res: Response): void => {
  const { discordUserId, username, avatarUrl } = (req as AuthedRequest).adminSession;
  res.json({ id: discordUserId, username, avatarUrl });
});

// ─── /admin/stats ─────────────────────────────────────────────────────────
router.get("/admin/stats", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [guilds, botUser] = await Promise.all([cachedGuilds(), getBotUser()]);
    const totalMembers = guilds.reduce((s, g) => s + (g.approximate_member_count ?? 0), 0);
    res.json({
      guildCount: guilds.length,
      totalMembers,
      commandCount: 112,
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      botUsername: botUser.username,
      botAvatarUrl: userAvatarUrl(botUser.id, botUser.avatar),
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch bot stats");
    res.status(502).json({ error: "Could not reach Discord API" });
  }
});

// ─── /admin/guilds ────────────────────────────────────────────────────────
router.get("/admin/guilds", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const guilds = await cachedGuilds();
    res.json(guilds.map(g => ({
      id: g.id,
      name: g.name,
      iconUrl: guildIconUrl(g.id, g.icon),
      memberCount: g.approximate_member_count ?? 0,
      ownerId: g.owner ? "you" : "unknown",
      joinedAt: null as string | null,
    })));
  } catch (err) {
    logger.error({ err }, "Failed to fetch guilds");
    res.status(502).json({ error: "Could not reach Discord API" });
  }
});

// ─── DELETE /admin/guilds/:guildId — bot leaves guild ─────────────────────
router.delete("/admin/guilds/:guildId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as { guildId: string };
  try {
    await leaveGuild(guildId);
    guildCache = null;
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, guildId }, "Failed to leave guild");
    res.status(502).json({ error: "Could not leave guild" });
  }
});

// ─── GET /admin/guilds/:guildId/members ───────────────────────────────────
router.get("/admin/guilds/:guildId/members", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as { guildId: string };
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  try {
    const members = await getGuildMembers(guildId, limit);
    res.json(members.map(m => ({
      userId: m.user.id,
      username: m.user.username,
      displayName: m.nick ?? m.user.global_name ?? m.user.username,
      avatarUrl: m.user.avatar ? userAvatarUrl(m.user.id, m.user.avatar) : null,
      isBot: m.user.bot ?? false,
      joinedAt: m.joined_at ?? null,
      roles: m.roles,
    })));
  } catch (err) {
    logger.error({ err, guildId }, "Failed to fetch guild members");
    res.status(502).json({ error: "Could not fetch members" });
  }
});

// ─── POST /admin/guilds/:guildId/members/:userId/kick ─────────────────────
router.post("/admin/guilds/:guildId/members/:userId/kick", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId } = req.params as { guildId: string; userId: string };
  const reason = (req.body?.reason as string | undefined) || "Kicked via Loopy Admin Panel";
  try {
    await kickMember(guildId, userId, reason);
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("10007")) {
      res.status(404).json({ error: "Member not found in this guild" });
      return;
    }
    logger.error({ err, guildId, userId }, "Failed to kick member");
    res.status(502).json({ error: "Could not kick member — check bot permissions" });
  }
});

// ─── GET /admin/guilds/:guildId/channels ──────────────────────────────────
router.get("/admin/guilds/:guildId/channels", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as { guildId: string };
  try {
    const channels = await getGuildChannels(guildId);

    // Build category name map
    const categoryMap = new Map<string, string>();
    channels.forEach(c => { if (c.type === 4) categoryMap.set(c.id, c.name); });

    const sorted = [...channels].sort((a, b) => {
      const aCat = a.parent_id ?? a.id;
      const bCat = b.parent_id ?? b.id;
      if (aCat !== bCat) return aCat.localeCompare(bCat);
      return (a.position ?? 0) - (b.position ?? 0);
    });

    res.json(sorted.map(c => ({
      id: c.id,
      name: c.name,
      type: channelTypeName(c.type),
      position: c.position ?? 0,
      parentId: c.parent_id ?? null,
      parentName: c.parent_id ? (categoryMap.get(c.parent_id) ?? null) : null,
      memberCount: c.member_count ?? null,
    })));
  } catch (err) {
    logger.error({ err, guildId }, "Failed to fetch guild channels");
    res.status(502).json({ error: "Could not fetch channels" });
  }
});

// ─── DELETE /admin/guilds/:guildId/channels/:channelId ────────────────────
router.delete("/admin/guilds/:guildId/channels/:channelId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as { guildId: string; channelId: string };
  try {
    await deleteChannel(channelId, "Deleted via Loopy Admin Panel");
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("10003")) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    logger.error({ err, channelId }, "Failed to delete channel");
    res.status(502).json({ error: "Could not delete channel — check bot permissions" });
  }
});

// ─── GET /admin/commands ──────────────────────────────────────────────────
router.get("/admin/commands", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = await getApplicationId();
    const commands = await getGlobalCommands(appId);
    res.json(commands.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      guildId: c.guild_id ?? null,
    })));
  } catch (err) {
    logger.error({ err }, "Failed to fetch commands");
    res.status(502).json({ error: "Could not fetch commands" });
  }
});

// ─── POST /admin/send-message ─────────────────────────────────────────────
router.post("/admin/send-message", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { channelId, content } = req.body as { channelId?: string; content?: string };
  if (!channelId || !content?.trim()) {
    res.status(400).json({ error: "channelId and content are required" });
    return;
  }
  try {
    const msg = await sendChannelMessage(channelId, content.trim());
    res.json({ ok: true, messageId: msg.id });
  } catch (err) {
    logger.error({ err, channelId }, "Failed to send message");
    res.status(502).json({ error: "Could not send message — check bot permissions for that channel" });
  }
});

// ─── POST /admin/run-command ──────────────────────────────────────────────
const BRIDGE_PORT = process.env.LOOPY_BRIDGE_PORT ?? "4310";

router.post("/admin/run-command", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guildId, channelId, command } = req.body as { guildId?: string; channelId?: string; command?: string };
  if (!guildId || !channelId || !command?.trim()) {
    res.status(400).json({ error: "guildId, channelId and command are required" });
    return;
  }
  const { discordUserId } = (req as AuthedRequest).adminSession;
  try {
    const bridgeRes = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-token": process.env.SESSION_SECRET ?? "",
      },
      body: JSON.stringify({ guildId, channelId, userId: discordUserId, command: command.trim() }),
      signal: AbortSignal.timeout(35_000),
    });
    const data = (await bridgeRes.json()) as { ok?: boolean; messages?: number; error?: string };
    if (!bridgeRes.ok) {
      // 401/500 from the bridge indicate infrastructure problems, not user error
      const status = bridgeRes.status === 422 ? 422 : 502;
      res.status(status).json({ error: data.error ?? "Command failed" });
      return;
    }
    res.json({ ok: true, messages: data.messages ?? 0 });
  } catch (err) {
    logger.error({ err, guildId, channelId }, "Command bridge unreachable");
    res.status(502).json({ error: "Bot is not reachable — is it running?" });
  }
});

// ─── Invite targets ───────────────────────────────────────────────────────
router.get("/admin/invite-targets", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [targets, guilds] = await Promise.all([
      db.select().from(inviteTargetsTable).orderBy(inviteTargetsTable.addedAt),
      cachedGuilds().catch(() => [] as Awaited<ReturnType<typeof getBotGuilds>>),
    ]);
    const botGuildIds = new Set(guilds.map(g => g.id));
    res.json(targets.map(t => ({
      id: t.id,
      guildId: t.guildId,
      label: t.label,
      botAlreadyIn: botGuildIds.has(t.guildId),
      inviteUrl: buildInviteUrl(t.guildId),
      addedAt: t.addedAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Failed to fetch invite targets");
    res.status(500).json({ error: "Database error" });
  }
});

router.post("/admin/invite-targets", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { guildId, label } = req.body as { guildId?: string; label?: string };
  if (!guildId || !/^\d{17,20}$/.test(guildId)) {
    res.status(400).json({ error: "Invalid server ID — must be a Discord snowflake (17-20 digits)" });
    return;
  }
  try {
    const [row] = await db.insert(inviteTargetsTable).values({ guildId, label: label ?? null }).returning();
    const guilds = await cachedGuilds().catch(() => [] as Awaited<ReturnType<typeof getBotGuilds>>);
    const botGuildIds = new Set(guilds.map(g => g.id));
    res.status(201).json({
      id: row.id, guildId: row.guildId, label: row.label,
      botAlreadyIn: botGuildIds.has(row.guildId),
      inviteUrl: buildInviteUrl(row.guildId),
      addedAt: row.addedAt.toISOString(),
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      res.status(400).json({ error: "This server ID is already in the list" });
      return;
    }
    logger.error({ err }, "Failed to add invite target");
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/admin/invite-targets/:targetId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const targetId = Number((req.params as { targetId: string }).targetId);
  if (isNaN(targetId)) { res.status(400).json({ error: "Invalid target ID" }); return; }
  const [deleted] = await db.delete(inviteTargetsTable).where(eq(inviteTargetsTable.id, targetId)).returning();
  if (!deleted) { res.status(404).json({ error: "Invite target not found" }); return; }
  res.json({ ok: true });
});

router.get("/admin/invite-url/:guildId", requireAdmin, (req: Request, res: Response): void => {
  const { guildId } = req.params as { guildId: string };
  res.json({ url: buildInviteUrl(guildId), guildId });
});

export default router;
