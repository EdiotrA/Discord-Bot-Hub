---
name: Discord server access
description: Permission boundary for adding Loopy to servers and accessing server data.
---

Loopy must use Discord's official invite URL so a person can choose a server and review permissions before adding it. It must not attempt to discover, join, or access other servers silently.

**Why:** Discord's authorization model requires explicit server selection and permission approval, and the user dismissed the optional Discord account connection.

**How to apply:** Keep `/invite` visible and explain the approval screen; any server-side action must be limited to guilds where the bot is already installed and has the required Discord permission.