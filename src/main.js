const path = require('path');
const fs   = require('fs');
const { Client, IntentsBitField, Collection } = require('discord.js');
const { REST }   = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');

require('dotenv').config();

const token     = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!token) {
    console.error("❌ No TOKEN found in .env");
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error("❌ No CLIENT_ID found in .env");
    process.exit(1);
}

// ── Logging ────────────────────────────────────────────────────────────────

const logPath = path.join(__dirname, 'commandLogs.json');

function logCommandUsage(user, commandName) {
    let data = [];
    if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '[]');
    try { data = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch { data = []; }

    data.push({
        username: user.tag ?? user.username,
        userId:   user.id,
        command:  commandName,
        time:     new Date().toISOString()
    });

    fs.writeFileSync(logPath, JSON.stringify(data, null, 2));
}

// ── Client setup ───────────────────────────────────────────────────────────

const cln = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMembers,   // needed for member fetching
    ]
});

cln.commands = new Collection();

// ── File loader (recursive) ────────────────────────────────────────────────

function getFiles(dir) {
    let files = [];
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            files = files.concat(getFiles(full));
        } else if (item.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

// ── Load commands ──────────────────────────────────────────────────────────

const commandsDir  = path.join(__dirname, 'commands');
const commandFiles = getFiles(commandsDir);
const slashCommands = [];

for (const file of commandFiles) {
    const exported = require(file);
    const cmds = Array.isArray(exported) ? exported : [exported];

    for (const cmd of cmds) {
        if (!cmd?.data) continue;
        cln.commands.set(cmd.data.name, cmd);
        slashCommands.push(cmd.data.toJSON());
    }
}

console.log(`📦 Loaded ${cln.commands.size} command(s).`);

// ── Ready ──────────────────────────────────────────────────────────────────

cln.once("clientReady", async () => {
    console.log(`✅ Logged in as ${cln.user.tag}`);

    try {
        const rest = new REST({ version: '10' }).setToken(token);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
        console.log("✅ Slash commands registered globally!");
    } catch (err) {
        console.error("❌ Failed to register slash commands:", err);
    }
});

// ── Slash commands ─────────────────────────────────────────────────────────

cln.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = cln.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
        logCommandUsage(interaction.user, interaction.commandName);
    } catch (err) {
        console.error(`❌ Error in /${interaction.commandName}:`, err);

        const payload = { content: "❌ An error occurred while executing that command.", ephemeral: true };
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply(payload).catch(() => {});
        } else {
            await interaction.followUp(payload).catch(() => {});
        }
    }
});

// ── Prefix / message commands ──────────────────────────────────────────────

function getGuildPrefix(guildId) {
    const prefixCmd = cln.commands.get("prefix");
    return prefixCmd?.getPrefix?.(guildId) ?? "!!";
}

cln.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.guild) return;

    const prefix = getGuildPrefix(msg.guild.id);
    if (!msg.content.startsWith(prefix)) return;

    const args = msg.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    const command = cln.commands.get(commandName);
    if (!command?.onMessage) return;

    try {
        await command.onMessage(msg, args);
        logCommandUsage(msg.author, commandName);
    } catch (err) {
        console.error(`❌ Error in prefix command "${commandName}":`, err);
        msg.reply("❌ An error occurred while executing that command.").catch(() => {});
    }
});

// ── Login ──────────────────────────────────────────────────────────────────

cln.login(token);