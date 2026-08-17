---
name: Settings snowflake precision
description: Why guild settings reads must never JSON.parse Discord IDs into numbers
---
The bot's `getSetting` JSON.parses stored values. Discord snowflake IDs (17-19 digits) exceed JS safe-integer precision, so parsing them to numbers silently corrupts the last digits (e.g. `…223161` → `…223200`), making channel/role lookups fail with "Unknown Channel" even though the DB is correct.

**Why:** This broke welcome messages in multiple guilds; the DB values were right, only the read path corrupted them.

**How to apply:** Any settings/JSON read path must keep numeric strings as strings when `!Number.isSafeInteger(parsed)` or the string doesn't round-trip. Always store and compare Discord IDs as strings end-to-end.

Also: the bridge has a token-protected localhost `POST /test-welcome` endpoint that runs the real guildMemberAdd handler for a given guild+user — useful to verify welcome flow without a real join (note: runs full handler incl. autorole).
