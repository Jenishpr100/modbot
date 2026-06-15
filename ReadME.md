# 🛡️ ModBot — Discord Moderation Bot
# v1.0.0

A fully-featured Discord moderation bot built with **discord.js v14**. Supports both slash commands (`/`) and prefix message commands (`!!` by default, configurable per server). Every moderation action is logged to a dedicated channel and tracked in per-moderator statistics.

---

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Command Reference](#command-reference)
  - [Moderation](#moderation-commands)
  - [Warnings](#warning-commands)
  - [Utility](#utility-commands)
  - [Admin](#admin-commands)
- [Permissions Guide](#permissions-guide)
- [Data Storage](#data-storage)
- [Adding New Commands](#adding-new-commands)
- [Common Issues](#common-issues)

---

## ✨ Features

- **Slash commands + prefix commands** — every command works both ways
- **Modlog channel** — all mod action embeds are mirrored to a single channel automatically
- **Mod statistics** — track warns, kicks, bans, mutes, purges, locks, and slowmodes per moderator
- **Warning system** — unique 4-digit codes per warning, viewable by users and mods
- **Role hierarchy enforcement** — moderators cannot act on members with equal or higher roles
- **Per-server prefix** — each guild can set its own prefix; stored persistently
- **Private moderator notes** — attach internal notes to users that they can never see
- **Full embed UI** — every response uses rich Discord embeds with colors, thumbnails, and timestamps

---

## 🔧 Prerequisites

- [Node.js](https://nodejs.org/) **v18 or higher**
- A Discord application and bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
- Bot invited to your server with the **bot** and **applications.commands** scopes

---

## 🚀 Installation

**1. Clone the repository**

```bash
git clone https://github.com/yourusername/modbot.git
cd modbot
```

**2. Install dependencies**

```bash
npm install discord.js @discordjs/rest discord-api-types dotenv
```

**3. Create your `.env` file**

```bash
cp .env.example .env
```

Then fill in your values (see [Configuration](#configuration) below).

**4. Start the bot**

```bash
node main.js
```

Slash commands are registered globally on startup. It may take up to an hour for Discord to propagate them to all servers. For instant registration during development, switch to guild-scoped registration by replacing `Routes.applicationCommands(CLIENT_ID)` with `Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)` in `main.js`.

---

## ⚙️ Configuration

Create a `.env` file in the root of the project:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
```

| Variable    | Description                                                                   |
|-------------|-------------------------------------------------------------------------------|
| `TOKEN`     | Your bot token from the Discord Developer Portal                              |
| `CLIENT_ID` | Your application's ID (found on the General Information page of your app)    |

### Required Bot Permissions

When inviting the bot, make sure to include the following permissions:

| Permission              | Needed for                              |
|-------------------------|-----------------------------------------|
| Manage Messages         | `/purge`                                |
| Kick Members            | `/kick`                                 |
| Ban Members             | `/ban`, `/unban`                        |
| Moderate Members        | `/mute`, `/unmute`, `/warn`, `/unwarn`  |
| Manage Channels         | `/lock`, `/unlock`, `/slowmode`         |
| Send Messages           | Sending modlog and response embeds      |
| Embed Links             | All embed-based responses               |
| Read Message History    | `/purge` bulk delete                    |

### Required Privileged Intents

In the Discord Developer Portal under your app's **Bot** page, enable:

- **Server Members Intent** — required for member fetching
- **Message Content Intent** — required for prefix commands

---

## 📁 Project Structure

```
modbot/
├── main.js                  # Bot entry point, command loader, event handlers
├── utils.js                 # Shared helpers: modlog, modstats, error embeds
├── .env                     # Bot token and client ID (never commit this)
├── .env.example             # Template for .env
│
├── commands/
│   ├── warnings.js          # /warn, /warnings, /unwarn
│   ├── kickban.js           # /kick, /ban, /unban
│   ├── mute.js              # /mute, /unmute
│   ├── prefix.js            # /prefix (per-server prefix management)
│   ├── modlog.js            # /modlog (set log channel)
│   ├── modstats.js          # /modstats (per-mod action stats)
│   └── modtools.js          # /purge, /slowmode, /lock, /unlock,
│                            #   /userinfo, /serverinfo, /note
│
└── data/                    # Auto-created JSON data files
    ├── warnings.json        # Warning records per guild
    ├── mutes.json           # Mute history log
    ├── prefixes.json        # Per-guild prefixes
    ├── modlog_channels.json # Modlog channel per guild
    ├── modstats.json        # Per-moderator action counts
    ├── notes.json           # Private moderator notes
    └── commandLogs.json     # Raw log of every command used
```

> **Note:** All JSON data files are created automatically the first time the bot runs. You do not need to create them manually.

---

## 📖 Command Reference

All commands support both `/slash` and `!!prefix` usage unless noted. Replace `!!` with your server's configured prefix.

---

### Moderation Commands

#### `/mute <user> <time> [reason]`
Times out a user for a specified duration using Discord's native timeout system.

| Argument | Required | Description |
|----------|----------|-------------|
| `user`   | ✅ | The member to mute |
| `time`   | ✅ | Duration: `10s`, `5m`, `12h`, `1d` (max `28d`) |
| `reason` | ❌ | Reason shown in the modlog embed |

**Permission required:** Moderate Members  
**Prefix usage:** `!!mute @user 10m Spamming`

---

#### `/unmute <user> [reason]`
Removes a Discord timeout from a user before it expires.

**Permission required:** Moderate Members  
**Prefix usage:** `!!unmute @user`

---

#### `/kick <user> [reason]`
Kicks a member from the server. They can rejoin with a new invite.

**Permission required:** Kick Members  
**Prefix usage:** `!!kick @user Breaking rules`

---

#### `/ban <user> [reason] [deletedays]`
Permanently bans a user. Works on users no longer in the server (by ID).

| Argument      | Required | Description |
|---------------|----------|-------------|
| `user`        | ✅ | The user to ban (mention or ID) |
| `reason`      | ❌ | Reason for the ban |
| `deletedays`  | ❌ | Days of messages to delete (0–7, default 0) |

**Permission required:** Ban Members  
**Prefix usage:** `!!ban @user Repeated offences`

---

#### `/unban <userid> [reason]`
Unbans a user by their Discord user ID.

**Permission required:** Ban Members  
**Prefix usage:** `!!unban 123456789012345678 Appeal approved`

---

#### `/purge <amount> [user]`
Bulk-deletes up to 100 messages from the current channel. Optionally filters by a specific user. Only works on messages younger than 14 days (Discord API limitation).

**Permission required:** Manage Messages  
**Prefix usage:** `!!purge 50`

---

#### `/slowmode <seconds>`
Sets the message slowmode for the current channel. Use `0` to disable.

**Permission required:** Manage Channels  
**Prefix usage:** `!!slowmode 10`

---

#### `/lock [reason]`
Prevents `@everyone` from sending messages in the current channel.

**Permission required:** Manage Channels  
**Prefix usage:** `!!lock Raid in progress`

---

#### `/unlock [reason]`
Restores `@everyone`'s ability to send messages in the current channel.

**Permission required:** Manage Channels  
**Prefix usage:** `!!unlock Situation resolved`

---

### Warning Commands

#### `/warn <user> [reason]`
Issues a warning to a user. Each warning is assigned a unique 4-digit case code (e.g. `0042`). Warns are stored per guild and never expire unless manually removed with `/unwarn`.

**Permission required:** Moderate Members  
**Prefix usage:** `!!warn @user Inappropriate language`

---

#### `/warnings [user]`
Lists warnings for a user. Moderators can view any user's warnings. Regular users can only view their own, and the response is sent as an ephemeral (private) message.

**Shows:** Case code, timestamp, reason, and (for mods) which moderator issued it.

**Prefix usage:** `!!warnings @user`

---

#### `/unwarn <code>`
Removes a specific warning by its 4-digit case code. The code is permanently retired and will never be reissued.

**Permission required:** Moderate Members  
**Prefix usage:** `!!unwarn 0042`

---

### Utility Commands

#### `/userinfo [user]`
Displays detailed information about a server member.

**Shows:** Username, ID, account creation date, server join date, nickname, roles (up to 10), bot status.

**Prefix usage:** `!!userinfo @user`

---

#### `/serverinfo`
Displays an overview of the current server.

**Shows:** Owner, server ID, creation date, total members (humans vs bots), channel counts, role count, boost level and count.

**Prefix usage:** `!!serverinfo`

---

#### `/note manage add <user> <text>`
Adds a private internal note to a user. Notes are never visible to the user — only to moderators who run `/note manage view`.

#### `/note manage view <user>`
Lists all notes attached to a user (shown only to the moderator, as an ephemeral reply).

#### `/note manage clear <user>`
Clears all notes for a user.

**Permission required:** Moderate Members  
**Note:** `/note` is slash-only (no prefix version) due to its subcommand structure.

---

### Admin Commands

#### `/modlog [channel]`
Sets the channel where all moderation action embeds will be mirrored. Run without a channel argument to see the currently configured channel.

**Permission required:** Administrator  
**Example:** `/modlog #mod-logs`

---

#### `/modstats [mod]`
Shows moderation action statistics for a specific moderator (or yourself if no user is provided). Only usable by members who have the **Moderate Members** permission.

**Tracked stats:** Warns ⚠️ · Kicks 👢 · Bans 🔨 · Mutes 🔇 · Purges 🧹 · Slowmodes ⏱️ · Locks 🔒 · Unlocks 🔓

> Unwarn, unban, and unmute are intentionally **not** counted.

Running `!!modstats` (prefix version with no arguments) shows a **full server leaderboard** of all moderators sorted by total actions.

---

#### `/prefix <newprefix>`
Changes the bot's command prefix for your server. Persists across restarts. Maximum 5 characters.

**Permission required:** Administrator  
**Example:** `/prefix ?` → prefix is now `?warn`, `?ban`, etc.

---

## 🔐 Permissions Guide

| Role Level         | What they can do |
|--------------------|-----------------|
| Regular member     | `/warnings` (own only), `/userinfo`, `/serverinfo` |
| Moderate Members   | All of the above + `/warn`, `/unwarn`, `/mute`, `/unmute`, `/note`, `/modstats` |
| Kick Members       | + `/kick` |
| Ban Members        | + `/ban`, `/unban` |
| Manage Messages    | + `/purge` |
| Manage Channels    | + `/slowmode`, `/lock`, `/unlock` |
| Administrator      | + `/modlog`, `/prefix` |

The bot also enforces **role hierarchy**: a moderator cannot kick, ban, mute, or warn someone whose highest role is equal to or above their own. The bot itself is subject to the same check — if the bot's highest role is below the target's role, the action is blocked with a clear error message.

---

## 💾 Data Storage

All data is stored locally as JSON files inside a `data/` folder (or alongside the command files depending on your setup). There is no database dependency.

| File                    | Contents |
|-------------------------|----------|
| `warnings.json`         | All warnings per guild, indexed by guild ID. Includes used codes, user IDs, moderator IDs, reasons, and timestamps. |
| `mutes.json`            | A log of every mute issued (userId, moderatorId, reason, mutedAt, expiresAt). Not used for enforcement — Discord's timeout handles that natively. |
| `prefixes.json`         | Maps guild IDs to their configured prefix. |
| `modlog_channels.json`  | Maps guild IDs to their modlog channel ID. |
| `modstats.json`         | Maps guild IDs → moderator IDs → action counts. |
| `notes.json`            | Private mod notes, indexed by guild ID then user ID. |
| `commandLogs.json`      | A flat log of every command used: username, user ID, command name, timestamp. |

> ⚠️ **Back these files up regularly.** They are the bot's entire persistent state. Deleting them is equivalent to wiping all warning history, stats, and configuration.

---

## 🧩 Adding New Commands

The command loader in `main.js` scans the entire `commands/` folder recursively and supports both single exports and array exports.

**Single command export:**
```js
// commands/ping.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check bot latency"),

    async execute(interaction) {
        await interaction.reply(`🏓 Pong! Latency: ${interaction.client.ws.ping}ms`);
    },

    async onMessage(msg, args) {
        await msg.reply(`🏓 Pong! Latency: ${msg.client.ws.ping}ms`);
    }
};
```

**Multiple commands from one file (array export):**
```js
module.exports = [commandA, commandB, commandC];
```

To hook into the modlog and stats system, import from `utils.js`:
```js
const { sendToModlog, trackStat, errorEmbed } = require("../utils");

// After a successful action:
await sendToModlog(guild, embed);
trackStat(guild.id, moderator.id, "yourActionName");
```

---

## 🛠️ Common Issues

**Slash commands not appearing**  
Global commands can take up to 1 hour to propagate. For instant updates during development, use guild-scoped commands (see [Installation](#installation)).

**`Missing Permissions` errors**  
Make sure the bot's role is placed **above** the roles of users it needs to moderate in Server Settings → Roles.

**`MESSAGE_CONTENT` intent errors**  
Enable the **Message Content Intent** in the Discord Developer Portal under your app's Bot page.

**Prefix commands not working**  
Check that `GuildMembers` and `MessageContent` intents are enabled both in the Developer Portal and in `main.js`. Also verify your `.env` `TOKEN` is correct and the bot is online.

**`Cannot read properties of null (reading 'permissions')`**  
This usually means the bot tried to act on a member who left the server before the action completed. This is handled gracefully in most commands with null checks.

---

## 📄 License

MIT License — free to use, modify, and distribute. See `LICENSE` for details.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change. Please make sure all commands include both a slash (`execute`) and prefix (`onMessage`) handler, and wire into `sendToModlog` and `trackStat` where appropriate.
