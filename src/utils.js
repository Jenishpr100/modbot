const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

// ── File paths ─────────────────────────────────────────────────────────────

const MODLOG_FILE  = path.join(__dirname, "modlog_channels.json");
const MODSTATS_FILE = path.join(__dirname, "modstats.json");

for (const f of [MODLOG_FILE, MODSTATS_FILE]) {
    if (!fs.existsSync(f)) fs.writeFileSync(f, "{}");
}

// ── Modlog channels ────────────────────────────────────────────────────────

function loadModlogChannels() {
    try { return JSON.parse(fs.readFileSync(MODLOG_FILE, "utf8")); }
    catch { return {}; }
}

function saveModlogChannels(data) {
    fs.writeFileSync(MODLOG_FILE, JSON.stringify(data, null, 2));
}

function setModlogChannel(guildId, channelId) {
    const data = loadModlogChannels();
    data[guildId] = channelId;
    saveModlogChannels(data);
}

function getModlogChannelId(guildId) {
    return loadModlogChannels()[guildId] ?? null;
}

/**
 * Send a copy of `embed` to the guild's modlog channel.
 * Silently does nothing if no channel is set or the channel is missing.
 */
async function sendToModlog(guild, embed) {
    const channelId = getModlogChannelId(guild.id);
    if (!channelId) return;

    try {
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error("❌ modlog send failed:", err);
    }
}

// ── Modstats ───────────────────────────────────────────────────────────────

function loadStats() {
    try { return JSON.parse(fs.readFileSync(MODSTATS_FILE, "utf8")); }
    catch { return {}; }
}

function saveStats(data) {
    fs.writeFileSync(MODSTATS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Increment a stat for a moderator.
 * @param {string} guildId
 * @param {string} modId
 * @param {"warn"|"kick"|"ban"|"mute"|"unwarn"|"unban"|"unmute"|"slowmode"|"purge"|"lock"|"unlock"} action
 */
function trackStat(guildId, modId, action) {
    const data = loadStats();
    if (!data[guildId]) data[guildId] = {};
    if (!data[guildId][modId]) data[guildId][modId] = {};
    data[guildId][modId][action] = (data[guildId][modId][action] ?? 0) + 1;
    saveStats(data);
}

/**
 * Returns stat object for a mod, or null if they have no stats.
 */
function getStats(guildId, modId) {
    const data = loadStats();
    return data[guildId]?.[modId] ?? null;
}

/**
 * Returns a map of { modId -> statsObj } for the whole guild.
 */
function getAllStats(guildId) {
    const data = loadStats();
    return data[guildId] ?? {};
}

// ── Shared embed builders ──────────────────────────────────────────────────

function errorEmbed(description) {
    return new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle("❌ Error")
        .setDescription(description)
        .setTimestamp();
}

module.exports = {
    setModlogChannel,
    getModlogChannelId,
    sendToModlog,
    trackStat,
    getStats,
    getAllStats,
    errorEmbed,
};