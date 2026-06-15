const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { sendToModlog, trackStat, errorEmbed } = require("../utils");

const WARN_FILE = path.join(__dirname, "warnings.json");
if (!fs.existsSync(WARN_FILE)) fs.writeFileSync(WARN_FILE, "{}");

// ── Persistence ────────────────────────────────────────────────────────────
// { "<guildId>": { usedCodes: [], warnings: [{ code, userId, moderatorId, reason, timestamp }] } }

function loadData() {
    try { return JSON.parse(fs.readFileSync(WARN_FILE, "utf8")); }
    catch { return {}; }
}

function saveData(data) {
    fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}

function getGuildData(data, guildId) {
    if (!data[guildId]) data[guildId] = { usedCodes: [], warnings: [] };
    return data[guildId];
}

// ── Code generator ─────────────────────────────────────────────────────────

function generateCode(guildData) {
    if (guildData.usedCodes.length >= 10_000)
        throw new Error("All 10,000 warning codes have been used in this server.");
    let code;
    do {
        code = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");
    } while (guildData.usedCodes.includes(code));
    return code;
}

// ── Embed builders ─────────────────────────────────────────────────────────

function warnEmbed(targetUser, moderator, reason, code) {
    return new EmbedBuilder()
        .setColor(0xF39C12)
        .setTitle("⚠️ Warning Issued")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: "User",      value: `${targetUser.username ?? targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: "Moderator", value: `${moderator.username ?? moderator.tag} (<@${moderator.id}>)`,   inline: true },
            { name: "Code",      value: `\`${code}\``,                                                    inline: true },
            { name: "Reason",    value: reason }
        )
        .setFooter({ text: `User ID: ${targetUser.id}` })
        .setTimestamp();
}

function warningsListEmbed(targetUser, warnings, viewerIsMod) {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📋 Warnings — ${targetUser.username ?? targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .setFooter({ text: `User ID: ${targetUser.id} · Total: ${warnings.length}` })
        .setTimestamp();

    if (warnings.length === 0) {
        embed.setDescription("✅ This user has no warnings.");
        return embed;
    }

    const shown = warnings.slice(-10).reverse();
    for (const w of shown) {
        const date    = new Date(w.timestamp).toUTCString();
        const modLine = viewerIsMod ? `\nModerator: <@${w.moderatorId}>` : "";
        embed.addFields({ name: `Code \`${w.code}\` · ${date}`, value: `**Reason:** ${w.reason}${modLine}` });
    }

    if (warnings.length > 10)
        embed.setDescription(`Showing the 10 most recent of **${warnings.length}** total warnings.`);

    return embed;
}

function unwarnEmbed(targetUser, code, reason) {
    const name    = targetUser?.username ?? targetUser?.tag ?? "Unknown User";
    const userId  = targetUser?.id ?? "Unknown";

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle("🗑️ Warning Removed")
        .setDescription(`**${name}** (<@${userId}>) has had warning \`${code}\` removed.`)
        .addFields(
            { name: "User",            value: `${name} (<@${userId}>)`, inline: true },
            { name: "Case Code",       value: `\`${code}\``,            inline: true },
            { name: "Original Reason", value: reason }
        )
        .setFooter({ text: `User ID: ${userId}` })
        .setTimestamp();

    const avatarURL = targetUser?.displayAvatarURL?.();
    if (avatarURL) embed.setThumbnail(avatarURL);
    return embed;
}

// ── Core logic ─────────────────────────────────────────────────────────────

function addWarning(guildId, targetUser, moderator, reason) {
    const data  = loadData();
    const guild = getGuildData(data, guildId);
    const code  = generateCode(guild);

    guild.usedCodes.push(code);
    guild.warnings.push({
        code,
        userId:      targetUser.id,
        moderatorId: moderator.id,
        reason,
        timestamp:   Date.now()
    });

    saveData(data);
    return code;
}

function getWarnings(guildId, userId) {
    const data  = loadData();
    return data[guildId]?.warnings.filter(w => w.userId === userId) ?? [];
}

function removeWarning(guildId, code) {
    const data  = loadData();
    const guild = data[guildId];
    if (!guild) return null;

    const idx = guild.warnings.findIndex(w => w.code === code);
    if (idx === -1) return null;

    const [removed] = guild.warnings.splice(idx, 1);
    saveData(data);
    return removed;
}

function isMod(member) {
    return member.permissions.has(PermissionFlagsBits.ModerateMembers);
}

// ─────────────────────────────────────────────────────────────────────────────
// /warn
// ─────────────────────────────────────────────────────────────────────────────

const warnCommand = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Issue a warning to a user")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the warning").setRequired(false)),

    async execute(interaction) {
        const targetMember = interaction.options.getMember("user");
        const reason       = interaction.options.getString("reason") || "No reason provided";

        if (!targetMember)
            return interaction.reply({ embeds: [errorEmbed("That user is not in this server.")], ephemeral: true });
        if (targetMember.user.bot)
            return interaction.reply({ embeds: [errorEmbed("You cannot warn bots.")], ephemeral: true });

        const code  = addWarning(interaction.guild.id, targetMember.user, interaction.user, reason);
        const embed = warnEmbed(targetMember.user, interaction.user, reason, code);

        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "warn");
    },

    async onMessage(msg, args) {
        if (!isMod(msg.member))
            return msg.reply({ embeds: [errorEmbed("You need the **Moderate Members** permission to warn users.")] });

        const targetMember =
            msg.mentions.members.first() ||
            (args[0] ? await msg.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember)
            return msg.reply({ embeds: [errorEmbed("User not found. Mention them or provide their ID.")] });
        if (targetMember.user.bot)
            return msg.reply({ embeds: [errorEmbed("You cannot warn bots.")] });

        const reason = args.slice(1).join(" ") || "No reason provided";
        const code   = addWarning(msg.guild.id, targetMember.user, msg.author, reason);
        const embed  = warnEmbed(targetMember.user, msg.author, reason, code);

        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
        trackStat(msg.guild.id, msg.author.id, "warn");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /warnings
// ─────────────────────────────────────────────────────────────────────────────

const warningsCommand = {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a user's warnings (mods see everyone; users see only themselves)")
        .addUserOption(o =>
            o.setName("user").setDescription("User to look up (leave blank to see your own)").setRequired(false)
        ),

    async execute(interaction) {
        const modPerms   = isMod(interaction.member);
        const targetUser = interaction.options.getUser("user");

        if (targetUser && targetUser.id !== interaction.user.id && !modPerms)
            return interaction.reply({ embeds: [errorEmbed("You can only view your own warnings.")], ephemeral: true });

        const lookupUser = targetUser || interaction.user;
        const warns      = getWarnings(interaction.guild.id, lookupUser.id);
        const isSelf     = lookupUser.id === interaction.user.id;

        await interaction.reply({ embeds: [warningsListEmbed(lookupUser, warns, modPerms)], ephemeral: isSelf });
    },

    async onMessage(msg, args) {
        const modPerms = isMod(msg.member);

        let targetUser =
            msg.mentions.users.first() ||
            (args[0] ? (await msg.guild.members.fetch(args[0]).catch(() => null))?.user : null)
            || msg.author;

        if (targetUser.id !== msg.author.id && !modPerms)
            return msg.reply({ embeds: [errorEmbed("You can only view your own warnings.")] });

        const warns = getWarnings(msg.guild.id, targetUser.id);
        await msg.reply({ embeds: [warningsListEmbed(targetUser, warns, modPerms)] });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /unwarn
// ─────────────────────────────────────────────────────────────────────────────

const unwarnCommand = {
    data: new SlashCommandBuilder()
        .setName("unwarn")
        .setDescription("Remove a specific warning by its 4-digit code")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(o =>
            o.setName("code").setDescription("4-digit warning code (e.g. 0042)").setRequired(true)
        ),

    async execute(interaction) {
        const raw  = interaction.options.getString("code").trim();
        const code = raw.padStart(4, "0");

        if (!/^\d{4}$/.test(code))
            return interaction.reply({ embeds: [errorEmbed("Please provide a valid 4-digit numeric code. Example: `/unwarn 0042`")], ephemeral: true });

        const removed = removeWarning(interaction.guild.id, code);
        if (!removed)
            return interaction.reply({ embeds: [errorEmbed(`No warning with code \`${code}\` found in this server.`)], ephemeral: true });

        let warnedUser = null;
        try { warnedUser = await interaction.client.users.fetch(removed.userId); } catch {}

        const embed = unwarnEmbed(warnedUser, code, removed.reason || "No reason provided");
        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
    },

    async onMessage(msg, args) {
        if (!isMod(msg.member))
            return msg.reply({ embeds: [errorEmbed("You need the **Moderate Members** permission to remove warnings.")] });

        const raw = args[0]?.trim();
        if (!raw)
            return msg.reply({ embeds: [errorEmbed("Please provide a warning code. Example: `!!unwarn 0042`")] });

        const code = raw.padStart(4, "0");
        if (!/^\d{4}$/.test(code))
            return msg.reply({ embeds: [errorEmbed("Invalid code format. Must be a 4-digit number like `0042`.")] });

        const removed = removeWarning(msg.guild.id, code);
        if (!removed)
            return msg.reply({ embeds: [errorEmbed(`No warning with code \`${code}\` found in this server.`)] });

        let warnedUser = null;
        try { warnedUser = await msg.client.users.fetch(removed.userId); } catch {}

        const embed = unwarnEmbed(warnedUser, code, removed.reason || "No reason provided");
        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
    }
};

module.exports = [warnCommand, warningsCommand, unwarnCommand];