import { Router, type Request, type Response } from "express";
import { DatabaseSync } from "node:sqlite";
import path from "path";

const router = Router();

// Shared SQLite DB — bot writes schema, API server reads/writes tokens.
// CWD when run via pnpm from workspace root = Loopy-Command-Hub/artifacts/api-server/
const DB_PATH =
  process.env.LOOPY_DB_PATH ||
  path.resolve(process.cwd(), "../../bot/data/loopy.db");

function getDb() {
  try {
    return new DatabaseSync(DB_PATH);
  } catch (err) {
    console.error("[OAuth] Cannot open DB at", DB_PATH, err);
    return null;
  }
}

function htmlPage(title: string, body: string, success: boolean) {
  const color = success ? "#22C55E" : "#EF4444";
  const icon = success ? "✅" : "❌";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Loopy</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #1E1F22;
      color: #DCDDDE;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background: #2B2D31;
      border: 1px solid #3F4248;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 700; color: ${color}; margin-bottom: 0.75rem; }
    p { font-size: 0.95rem; line-height: 1.6; color: #B5BAC1; }
    strong { color: #DCDDDE; }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      background: #1E1F22;
      border: 1px solid #3F4248;
      border-radius: 999px;
      padding: 0.35rem 0.9rem;
      font-size: 0.8rem;
      color: #72767D;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <span class="badge">Loopy Bot</span>
  </div>
</body>
</html>`;
}

/** GET /api/oauth/discord — redirect the user to Discord's authorization page */
router.get("/oauth/discord", (req: Request, res: Response) => {
  const { state } = req.query;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;

  if (!clientId) {
    return res
      .status(503)
      .send(
        htmlPage(
          "Not Configured",
          "Discord OAuth is not configured on this server.",
          false,
        ),
      );
  }
  if (!state) {
    return res
      .status(400)
      .send(htmlPage("Invalid Link", "This link is missing required data.", false));
  }

  const redirectUri = `https://${devDomain}/api/oauth/discord/callback`;
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify guilds guilds.join");
  url.searchParams.set("state", String(state));
  url.searchParams.set("prompt", "none"); // skip re-consent if already authorized

  return res.redirect(url.toString());
});

/** GET /api/oauth/discord/callback — exchange code, store token */
router.get(
  "/oauth/discord/callback",
  async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(
        htmlPage(
          "Authorization Cancelled",
          "You cancelled the authorization. Return to Discord and try verifying again.",
          false,
        ),
      );
    }

    if (!code || !state) {
      return res
        .status(400)
        .send(
          htmlPage(
            "Invalid Request",
            "Missing authorization code. Please try again.",
            false,
          ),
        );
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const devDomain = process.env.REPLIT_DEV_DOMAIN;

    if (!clientId || !clientSecret) {
      return res
        .status(503)
        .send(
          htmlPage(
            "Not Configured",
            "Discord OAuth is not configured on this server.",
            false,
          ),
        );
    }

    const redirectUri = `https://${devDomain}/api/oauth/discord/callback`;

    // Exchange code for access token
    let tokenData: Record<string, unknown>;
    try {
      const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: redirectUri,
        }),
      });
      tokenData = (await tokenRes.json()) as Record<string, unknown>;
      if (!tokenRes.ok) {
        console.error("[OAuth] Token exchange failed:", tokenData);
        return res.send(
          htmlPage(
            "Authorization Failed",
            "Failed to exchange your authorization code. Please try again.",
            false,
          ),
        );
      }
    } catch (err) {
      console.error("[OAuth] Token exchange error:", err);
      return res.send(
        htmlPage(
          "Network Error",
          "Could not contact Discord. Please try again in a moment.",
          false,
        ),
      );
    }

    const accessToken = tokenData.access_token as string;
    const refreshToken = (tokenData.refresh_token as string) || null;
    const expiresIn = (tokenData.expires_in as number) || 604800;
    const scope = (tokenData.token_type as string)
      ? (tokenData.scope as string) || ""
      : "";
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // Decode state → userId  (format: base64url of "guildId:userId:robloxUsername")
    let userId: string;
    try {
      const decoded = Buffer.from(String(state), "base64url").toString("utf8");
      const parts = decoded.split(":");
      userId = parts[1];
      if (!userId) throw new Error("no userId in state");
    } catch {
      return res.send(
        htmlPage(
          "Invalid State",
          "The authorization link has expired or is invalid. Please start verification again.",
          false,
        ),
      );
    }

    // Persist token in shared SQLite DB
    const db = getDb();
    if (!db) {
      return res.send(
        htmlPage(
          "Database Error",
          "Could not save your authorization. Please try again.",
          false,
        ),
      );
    }
    try {
      db.prepare(
        `INSERT OR REPLACE INTO discord_oauth_tokens
           (user_id, access_token, refresh_token, scope, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(userId, accessToken, refreshToken, scope, expiresAt);
    } finally {
      db.close();
    }

    return res.send(
      htmlPage(
        "Authorized!",
        "You've successfully authorized Loopy. Return to Discord and click the <strong>Continue Verification</strong> button in your DM.",
        true,
      ),
    );
  },
);

export default router;
