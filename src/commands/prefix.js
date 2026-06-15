const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const PREFIX_FILE = path.join(__dirname, "prefixes.json");
if (!fs.existsSync(PREFIX_FILE)) fs.writeFileSync(PREFIX_FILE, "{}");

// ── Helpers ────────────────────────────────────────────────────────────────

function loadPrefixes() {
    try { return JSON.parse(fs.readFileSync(PREFIX_FILE, "utf8")); }
    catch { return {}; }
}

function savePrefixes(data) {
    fs.writeFileSync(PREFIX_FILE, JSON.stringify(data, null, 2));
}

function getPrefix(guildId) {
    return loadPrefixes()[guildId] || "!!";
}

function applyPrefix(guildId, newPrefix) {
    const prefixes = loadPrefixes();
    prefixes[guildId] = newPrefix;
    savePrefixes(prefixes);
}

// ── Module export ──────────────────────────────────────────────────────────

module.exports = {
    getPrefix,

    data: new SlashCommandBuilder()
        .setName("prefix")
        .setDescription("Change the server prefix for message commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o =>
            o.setName("newprefix").setDescription("New prefix (e.g. !, ?, >>)").setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ content: "❌ You need the **Administrator** permission to change the prefix.", ephemeral: true });

        const newPrefix = interaction.options.getString("newprefix");
        if (newPrefix.length > 5)
            return interaction.reply({ content: "❌ Prefix must be 5 characters or fewer.", ephemeral: true });

        applyPrefix(interaction.guild.id, newPrefix);
        await interaction.reply(`✅ Server prefix changed to \`${newPrefix}\``);
    },

    // BUG FIX: original code referenced `interaction` (undefined) instead of `msg`
    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator))
            return msg.reply("❌ You need the **Administrator** permission to change the prefix.");

        const newPrefix = args[0];
        if (!newPrefix) {
            const current = getPrefix(msg.guild.id);
            return msg.reply(`ℹ️ Current prefix is \`${current}\`. Usage: \`${current}prefix <newPrefix>\``);
        }

        if (newPrefix.length > 5)
            return msg.reply("❌ Prefix must be 5 characters or fewer.");

        applyPrefix(msg.guild.id, newPrefix);
        msg.reply(`✅ Server prefix changed to \`${newPrefix}\``);
    }
};