import { Router, type Request, type Response } from "express";
import { createSession, destroySession, requireAdmin, type AuthedRequest } from "../lib/adminAuth";
import { userAvatarUrl } from "../lib/discordApi";
import { logger } from "../lib/logger";

const router = Router();

const SESSION_COOKIE = "admin_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function buildRedirectUri() {
  return (
    process.env.ADMIN_REDIRECT_URI ||
    `https://${process.env.REPLIT_DEV_DOMAIN}/api/admin/auth/callback`
  );
}

/** GET /admin/auth/discord — kick off owner Discord OAuth */
router.get("/admin/auth/discord", (_req: Request, res: Response): void => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    res.status(503).send("DISCORD_CLIENT_ID is not configured.");
    return;
  }

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", buildRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("prompt", "none");

  res.redirect(url.toString());
});

/** GET /admin/auth/callback — Discord OAuth callback for owner */
router.get("/admin/auth/callback", async (req: Request, res: Response): Promise<void> => {
  const { code, error } = req.query as Record<string, string>;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const panelUrl = `https://${devDomain}/admin-panel/`;

  if (error) {
    res.redirect(`${panelUrl}?auth_error=cancelled`);
    return;
  }
  if (!code) {
    res.redirect(`${panelUrl}?auth_error=no_code`);
    return;
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const ownerId = process.env.OWNER_DISCORD_ID;

  if (!clientId || !clientSecret) {
    res.status(503).send("OAuth credentials not configured.");
    return;
  }

  // Exchange code for token
  let accessToken: string;
  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: buildRedirectUri(),
      }),
    });
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    if (!tokenRes.ok) {
      logger.error({ tokenData }, "Token exchange failed");
      res.redirect(`${panelUrl}?auth_error=token_exchange`);
      return;
    }
    accessToken = tokenData.access_token as string;
  } catch (err) {
    logger.error({ err }, "Token exchange network error");
    res.redirect(`${panelUrl}?auth_error=network`);
    return;
  }

  // Fetch Discord user identity
  let discordUser: { id: string; username: string; avatar: string | null };
  try {
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    discordUser = await userRes.json() as typeof discordUser;
    if (!discordUser.id) throw new Error("No user id");
  } catch (err) {
    logger.error({ err }, "Failed to fetch Discord user");
    res.redirect(`${panelUrl}?auth_error=user_fetch`);
    return;
  }

  // Verify this is the owner
  if (ownerId && discordUser.id !== ownerId) {
    logger.warn({ userId: discordUser.id }, "Non-owner login attempt rejected");
    res.redirect(`${panelUrl}?auth_error=not_owner`);
    return;
  }

  // Create session
  const token = await createSession({
    discordUserId: discordUser.id,
    username: discordUser.username,
    avatarUrl: userAvatarUrl(discordUser.id, discordUser.avatar),
  });

  res.cookie(SESSION_COOKIE, token, COOKIE_OPTS);
  res.redirect(panelUrl);
});

/** POST /admin/logout */
router.post("/admin/logout", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const session = (req as AuthedRequest).adminSession;
  await destroySession(session.token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

export default router;
