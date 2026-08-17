---
name: Roblox auth strategy
description: How the bot authenticates to Roblox for ranking/joining and its permission prerequisites
---

Rule: Roblox write actions (rank users, join/leave groups) use the bot account's `.ROBLOSECURITY` cookie (`ROBLOX_COOKIE` secret) against the legacy web APIs, with CSRF token harvest + cached-token retry. Open Cloud (`ROBLOX_OPEN_CLOUD_KEY`) is only a fallback for ranking when the cookie fails with 401/403.

**Why:** The user runs a dedicated bot Roblox account and supplied only the cookie; Open Cloud keys are per-group and not configured.

Roblox gates the group-JOIN endpoint behind a captcha challenge (`rblx-challenge-type: captcha`) — automated joining is impossible; the bot account must join each group once manually in a browser. Ranking (PATCH member role) is NOT captcha-gated and works automatically once the bot is in the group. `ensureBotInGroup()` runs at startup and on `/group set`, returning `member|joined|requested|captcha|failed`.

**AI verify questions:** `evaluateVerifyAnswers` must approve (not block) when AI is unavailable — blocking caused silent hard-fail for all verifications. `remoteUnavailableUntil` 10-min cooldown was reduced to 2 min for faster recovery. Use `extractJson()` helper for robust JSON parsing from Claude responses.

**Discord OAuth for verification:** scopes `identify guilds guilds.join` — `guilds` to check user's servers, `guilds.join` to PUT /guilds/{id}/members/{userId} with user access token (bot must be in target guild). Tokens stored in `discord_oauth_tokens` table (user_id PK). Pending verify state in `verify_oauth_pending` (user_id+guild_id PK). OAuth callback at `/api/oauth/discord/callback` on the API server (Loopy-Command-Hub/artifacts/api-server).

**Multi-group scale = per-guild Open Cloud API keys, NOT captcha bypass.** Do not build captcha-solving (bans the account). The scale path: each group owner runs `/group apikey <key>`; key is AES-256-GCM encrypted (keyed off SESSION_SECRET, which is mandatory — no fallback) and stored per-guild in `roblox_api_key` setting. `setUserRank(..., {openCloudKey})` prefers the guild key (no join/captcha needed). Validate keys against the memberships endpoint (the resource ranking uses), not just group GET. Clear the stored key whenever `/group set` changes the linked group — keys are group-scoped.

**How to apply:** Ranking only works if the bot Roblox account is *in* the target group with a role that has "Manage lower-ranked member ranks" and its rank is above the target rank. Cookie expiry surfaces as 401 — tell the user to refresh the `ROBLOX_COOKIE` secret. Never echo cookie material in user-facing errors.
