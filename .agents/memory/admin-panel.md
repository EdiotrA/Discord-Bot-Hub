---
name: Admin Panel Architecture
description: How the Loopy Admin Panel is built — auth flow, API routes, key env vars, and Discord gotchas.
---

## Auth flow
- Owner visits `/admin-panel/` → login page → clicks "Authenticate via Discord"
- Button is a plain `<a href="/api/admin/auth/discord">` (NOT a hook call)
- Server does Discord OAuth2 (scope: `identify`), verifies `discordUser.id === OWNER_DISCORD_ID`
- Session stored in PostgreSQL `admin_sessions` table as UUID token, 7-day expiry
- Cookie: `admin_token` (httpOnly, lax sameSite)
- `useGetAdminMe` with `{ query: { retry: false } }` is the auth gate check — 401 → show login

## Key env vars needed
- `OWNER_DISCORD_ID` — owner's Discord user ID (17-20 digit snowflake); if unset, any Discord user can log in
- `ADMIN_REDIRECT_URI` — optional override for callback URL; defaults to `https://{REPLIT_DEV_DOMAIN}/api/admin/auth/callback`
- Must add `https://{dev-domain}/api/admin/auth/callback` to Discord Developer Portal → OAuth2 → Redirects

## Files
- `artifacts/api-server/src/routes/adminAuth.ts` — Discord OAuth + session cookie
- `artifacts/api-server/src/routes/adminApi.ts` — all /admin/* REST endpoints
- `artifacts/api-server/src/lib/adminAuth.ts` — `requireAdmin` middleware, session CRUD
- `artifacts/api-server/src/lib/discordApi.ts` — Discord REST API calls (guild list, leave, bot user)
- `lib/db/src/schema/adminSessions.ts` — PostgreSQL session table
- `lib/db/src/schema/inviteTargets.ts` — PostgreSQL invite targets table
- `artifacts/admin-panel/src/` — React/Vite frontend

## React Query gotcha
- `useGetAdminMe` must be called with `{ query: { retry: false } }` or it hammers /api/admin/me in a 401 retry loop
- Global QueryClient in App.tsx also configured to skip retry on 4xx

## Discord API guild list
- `GET /users/@me/guilds?with_counts=true` works with Bot token
- Guild list cached 60s in memory (`guildCache`) to avoid rate limits
- Leaving a guild: `DELETE /users/@me/guilds/{guildId}` — busts cache after
- Member count comes from `approximate_member_count` on the guild list response

**Why:** The bot process and API server are separate — no IPC. API server calls Discord REST directly with bot token rather than trying to communicate with the bot process.
