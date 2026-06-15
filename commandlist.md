# ModBot Commands

## Moderation Commands

| Command | Description |
|----------|-------------|
| `/mute [user] [time] [reason]` | Temporarily mutes a user using Discord timeout system |
| `/unmute [user]` | Removes an active mute/timeout from a user |
| `/warn [user] [reason]` | Issues a warning and logs it to `warns.json` |
| `/warning [user]` | Displays all warnings for a user |
| `/ban [user] [reason]` | Permanently bans a user from the server |
| `/unban [user]` | Unbans a previously banned user |
| `/kick [user] [reason]` | Removes a user from the server without banning |

---

## Channel Management

| Command | Description |
|----------|-------------|
| `/lock` | Locks the current channel (prevents sending messages) |
| `/unlock` | Unlocks the current channel |
| `/slowmode [seconds]` | Sets slowmode delay in the current channel |
| `/modlog [channel]` | Sets the moderation log channel for the server |
| `/prefix [prefix]` | Sets a custom prefix for the server |

---

## User & Server Info

| Command | Description |
|----------|-------------|
| `/userinfo [user]` | Shows detailed information about a user |
| `/serverinfo` | Displays information about the current server |

---

## Logging System (Internal Data Files)

| File | Purpose |
|----------|-------------|
| `warns.json` | Stores all warnings (userId, moderatorId, reason, timestamps) |
| `mutes.json` | Stores mute records (active + historical moderation logs) |
| `prefix.json` | Maps guild IDs to custom bot prefixes |
| `modlog.json` | Stores modlog channel configuration per server |
| `modstats.json` | Tracks moderator actions (per guild + per moderator) |
| `notes.json` | Private moderator notes per user (guild-based storage) |
| `commandLogs.json` | Logs every command usage (user, ID, command, timestamp) |

---

## Bot Behavior Notes

- Discord timeout system is used for mute enforcement
- All moderation actions are logged automatically
- Warnings are stored but not enforced automatically
- Mod logs require channel setup using `/modlog`
- Prefix system is guild-based
