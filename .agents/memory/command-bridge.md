---
name: Admin panel command bridge
description: How the dashboard runs bot slash commands remotely and its limits
---
Discord's API cannot trigger real slash commands, so the admin panel uses a bridge: the bot runs a localhost-only HTTP server (port `LOOPY_BRIDGE_PORT`, default 4310) authenticated with an `x-bridge-token` header equal to `SESSION_SECRET`; the API server proxies `/api/admin/run-command` to it. The bridge builds a mock interaction (replies → `channel.send`, `deferReply` posts a real placeholder so `fetchReply().id` works) and pre-resolves user/channel/role options via fetch.

**Why:** users expect "run any bot command from the dashboard"; simulation is the only route, and cached-only lookups / flag-only defers broke poll, giveaway, and user-target commands in review.

**How to apply:** commands needing modals can't run over the bridge (they throw a friendly error). Bridge execution enforces the same `checkPermission` gate and a 30s timeout. Admin OAuth fails closed if `OWNER_DISCORD_ID` is unset.
