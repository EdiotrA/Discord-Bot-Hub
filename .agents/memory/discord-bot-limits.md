---
name: Discord bot limits
description: External Discord application-command limit relevant to Loopy command registration.
---

Loopy must expose no more than 100 global slash commands at registration time. Additional legacy command modules may remain in the codebase but need to stay out of the global registration payload unless commands are consolidated or removed.

**Why:** Discord rejects the entire global command update when the payload exceeds the application command limit.

**How to apply:** When adding commands, update the registration allowlist or consolidate related commands before restarting the bot.