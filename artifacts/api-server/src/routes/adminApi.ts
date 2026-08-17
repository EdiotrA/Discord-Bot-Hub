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
} from "../lib/discordApi";
import {
  GetAdminMeResponse,
  GetAdminStatsResponse,
  GetAdminGuildsResponse,
  GetInviteTargetsResponse,
  AddInviteTargetBody,
  KickFromGuildParams,
  RemoveInviteTargetParams,
  AddInviteTargetResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

// Simple in-memory cache for guild list (avoids hammering Discord API)
let guildCache: { data: Awaited<ReturnType<typeof getBotGuilds>>; ts: number } | null = null;
const GUILD_CACHE_TTL = 60_000; // 1 minute

async function cachedGuilds() {
  if (guildCache && Date.now() - guildCache.ts < GUILD_CACHE_TTL) return guildCache.data;
  const data = await getBotGuilds();
  guildCache = { data, ts: Date.now() };
  return data;
}

function buildInviteUrl(guildId: string): string {
  const clientId = process.env.DISCORD_CLIENT_ID ?? "";
  const perms = "8"; // Administrator
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&guild_id=${guildId}&scope=bot+applications.commands&permissions=${perms}`;
}

// Server start time for uptime calculation
const START_TIME = Date.now();

/** GET /admin/me */
router.get("/admin/me", requireAdmin, (req: Request, res: Response): void => {
  const { discordUserId, username, avatarUrl } = (req as AuthedRequest).adminSession;
  res.json(GetAdminMeResponse.parse({ id: discordUserId, username, avatarUrl }));
});

/** GET /admin/stats */
router.get("/admin/stats", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [guilds, botUser] = await Promise.all([cachedGuilds(), getBotUser()]);
    const totalMembers = guilds.reduce((s, g) => s + (g.approximate_member_count ?? 0), 0);
    res.json(GetAdminStatsResponse.parse({
      guildCount: guilds.length,
      totalMembers,
      commandCount: 100, // Loopy registers exactly 100 slash commands
      uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
      botUsername: botUser.username,
      botAvatarUrl: userAvatarUrl(botUser.id, botUser.avatar),
    }));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch bot stats");
    res.status(502).json({ error: "Could not reach Discord API" });
  }
});

/** GET /admin/guilds */
router.get("/admin/guilds", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const guilds = await cachedGuilds();
    const result = guilds.map(g => ({
      id: g.id,
      name: g.name,
      iconUrl: guildIconUrl(g.id, g.icon),
      memberCount: g.approximate_member_count ?? 0,
      ownerId: g.owner ? "you" : "unknown",
      joinedAt: null as string | null,
    }));
    res.json(GetAdminGuildsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch guilds");
    res.status(502).json({ error: "Could not reach Discord API" });
  }
});

/** DELETE /admin/guilds/:guildId */
router.delete("/admin/guilds/:guildId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.guildId) ? req.params.guildId[0] : req.params.guildId;
  const parsed = KickFromGuildParams.safeParse({ guildId: raw });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await leaveGuild(parsed.data.guildId);
    // Bust cache so next guild list request is fresh
    guildCache = null;
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, guildId: parsed.data.guildId }, "Failed to leave guild");
    res.status(502).json({ error: "Could not leave guild" });
  }
});

/** GET /admin/invite-targets */
router.get("/admin/invite-targets", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [targets, guilds] = await Promise.all([
      db.select().from(inviteTargetsTable).orderBy(inviteTargetsTable.addedAt),
      cachedGuilds().catch(() => [] as Awaited<ReturnType<typeof getBotGuilds>>),
    ]);

    const botGuildIds = new Set(guilds.map(g => g.id));

    const result = targets.map(t => ({
      id: t.id,
      guildId: t.guildId,
      label: t.label,
      botAlreadyIn: botGuildIds.has(t.guildId),
      inviteUrl: buildInviteUrl(t.guildId),
      addedAt: t.addedAt.toISOString(),
    }));

    res.json(GetInviteTargetsResponse.parse(result));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch invite targets");
    res.status(500).json({ error: "Database error" });
  }
});

/** POST /admin/invite-targets */
router.post("/admin/invite-targets", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = AddInviteTargetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { guildId, label } = parsed.data;

  // Basic Discord snowflake validation (17-20 digit numeric string)
  if (!/^\d{17,20}$/.test(guildId)) {
    res.status(400).json({ error: "Invalid server ID — must be a Discord snowflake (17-20 digits)" });
    return;
  }

  try {
    const [row] = await db
      .insert(inviteTargetsTable)
      .values({ guildId, label: label ?? null })
      .returning();

    const guilds = await cachedGuilds().catch(() => [] as Awaited<ReturnType<typeof getBotGuilds>>);
    const botGuildIds = new Set(guilds.map(g => g.id));

    res.status(201).json(AddInviteTargetResponse.parse({
      id: row.id,
      guildId: row.guildId,
      label: row.label,
      botAlreadyIn: botGuildIds.has(row.guildId),
      inviteUrl: buildInviteUrl(row.guildId),
      addedAt: row.addedAt.toISOString(),
    }));
  } catch (err: unknown) {
    // Unique constraint violation → already added
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      res.status(400).json({ error: "This server ID is already in the list" });
      return;
    }
    req.log.error({ err }, "Failed to add invite target");
    res.status(500).json({ error: "Database error" });
  }
});

/** DELETE /admin/invite-targets/:targetId */
router.delete("/admin/invite-targets/:targetId", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const raw = Array.isArray(req.params.targetId) ? req.params.targetId[0] : req.params.targetId;
  const parsed = RemoveInviteTargetParams.safeParse({ targetId: Number(raw) });
  if (!parsed.success || isNaN(Number(raw))) {
    res.status(400).json({ error: "Invalid target ID" });
    return;
  }

  const [deleted] = await db
    .delete(inviteTargetsTable)
    .where(eq(inviteTargetsTable.id, parsed.data.targetId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Invite target not found" });
    return;
  }

  res.json({ ok: true });
});

/** GET /admin/invite-url/:guildId */
router.get("/admin/invite-url/:guildId", requireAdmin, (req: Request, res: Response): void => {
  const raw = Array.isArray(req.params.guildId) ? req.params.guildId[0] : req.params.guildId;
  res.json({ url: buildInviteUrl(raw), guildId: raw });
});

export default router;
