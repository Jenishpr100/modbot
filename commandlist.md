# 🛡️ ModBot Commands

## 🔨 Moderation Commands

- **`/mute [user] [time] [reason]`**  
  Temporarily mutes a user using Discord timeout system

- **`/unmute [user]`**  
  Removes an active mute/timeout from a user

- **`/warn [user] [reason]`**  
  Issues a warning and logs it to `warns.json`

- **`/warning [user]`**  
  Displays all warnings for a user

- **`/ban [user] [reason]`**  
  Permanently bans a user from the server

- **`/unban [user]`**  
  Unbans a previously banned user

- **`/kick [user] [reason]`**  
  Removes a user from the server without banning them

---

## ⚙️ Channel Management

- **`/lock`**  
  Locks the current channel (prevents sending messages)

- **`/unlock`**  
  Unlocks the current channel

- **`/slowmode [seconds]`**  
  Sets slowmode delay in the current channel

- **`/modlog [channel]`**  
  Sets the moderation log channel for the server

- **`/prefix [prefix]`**  
  Sets a custom server prefix for the bot

- **`/purge [amount]`**  
  Deletes `amount` number of messages in the channel it was used on
---

## 👤 User, Server & Bot Info

- `/userinfo [user]` - Shows detailed information about a user
- `/serverinfo` - Displays information about the current server
- `/about` -  Displays the [`about`](https://jenishpr100.github.io/modbot/About).
- `/help` - Displays the [`Command Lists`](https://jenishpr100.github.io/modbot/commandlist).
- `/update` - Displays the current version of the bot.
---

## 🧾 Logging System (Internal Data Files)

- `warns.json` → Stores all warnings (userId, moderatorId, reason, timestamps)
- `mutes.json` → Stores mute records (active + historical moderation logs)
- `prefix.json` → Maps guild IDs to custom bot prefixes
- `modlog.json` → Stores modlog channel configuration per server
- `modstats.json` → Tracks moderator action counts per guild and moderator
- `notes.json` → Private moderator notes per user (guild-based storage)
- `commandLogs.json` → Logs every command usage (user, ID, command, timestamp)

---

## 🤖 Bot Behavior Notes

- Uses Discord timeout system for mute enforcement
- All moderation actions are automatically logged
- Warnings are stored but not auto-enforced
- Mod logs require `/modlog` setup per server
- Prefix system is stored per guild
