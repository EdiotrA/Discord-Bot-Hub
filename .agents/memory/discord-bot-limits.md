---
name: Discord bot limits
description: Discord platform constraints that shape Loopy bot design (command cap, timers, permissions)
---

# Discord bot limits & pitfalls

- **100 global slash commands max.** Loopy stays at exactly 100 by hiding legacy commands in the `hiddenLegacyCommands` set in the ready event. Any NEW command must hide another one or the whole registration fails. Verify visible count before restart.
  **How to apply:** run a quick loader script counting modules minus the hidden set.
- **Required options must precede optional ones** in every (sub)command, or registration fails with `APPLICATION_COMMAND_OPTIONS_REQUIRED_INVALID` for the whole command set.
- **`setDefaultMemberPermissions` is not enforcement.** Server admins can override it, and Loopy's own permission system treats fun-category commands as public. Any privileged action in a fun-category command needs a runtime `memberPermissions.has(...)` check.
  **Why:** `/giveaway` lives in fun/ and would otherwise be manageable by everyone.
- **`setTimeout` overflows past ~24.8 days** (2^31-1 ms). Long-running timers (giveaways up to 28 days) must chain timeouts. Polls/giveaways persist in SQLite and are re-scheduled in the ready event so restarts don't drop them.
