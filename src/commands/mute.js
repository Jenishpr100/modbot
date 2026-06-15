const fs = require("fs");
const path = require("path");
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { sendToModlog, trackStat, errorEmbed } = require("../utils");

const muteFile = path.join(__dirname, "mutes.json");
if (!fs.existsSync(muteFile)) fs.writeFileSync(muteFile, "[]");

// ── Time parser ────────────────────────────────────────────────────────────

function parseTime(str) {
    if (!str) return null;
    const match = str.toLowerCase().match(/^(\d+)(s|m|h|hr|d)$/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    const map = { s: 1_000, m: 60_000, h: 3_600_000, hr: 3_600_000, d: 86_400_000 };
    return (map[match[2]] ?? null) * num;
}

// ── Persistence ────────────────────────────────────────────────────────────

function saveMute(data) {
    let mutes = [];
    try { mutes = JSON.parse(fs.readFileSync(muteFile, "utf8")); } catch {}
    mutes.push(data);
    fs.writeFileSync(muteFile, JSON.stringify(mutes, null, 2));
}

// ── Embed builders ─────────────────────────────────────────────────────────

function muteSuccessEmbed(target, moderator, timeStr, reason) {
    return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle("🔇 Member Muted")
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
            { name: "User",      value: `${target.user.username ?? target.user.tag} (<@${target.id}>)`, inline: true },
            { name: "Moderator", value: `${moderator.username ?? moderator.tag} (<@${moderator.id}>)`, inline: true },
            { name: "Duration",  value: `\`${timeStr}\``, inline: true },
            { name: "Reason",    value: reason }
        )
        .setFooter({ text: `User ID: ${target.id}` })
        .setTimestamp();
}

function unmuteEmbed(target, moderator, reason) {
    return new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("🔊 Member Unmuted")
        .setThumbnail(target.user.displayAvatarURL())
        .addFields(
            { name: "User",      value: `${target.user.username ?? target.user.tag} (<@${target.id}>)`, inline: true },
            { name: "Moderator", value: `${moderator.username ?? moderator.tag} (<@${moderator.id}>)`, inline: true },
            { name: "Reason",    value: reason }
        )
        .setFooter({ text: `User ID: ${target.id}` })
        .setTimestamp();
}

// ── Core mute logic ────────────────────────────────────────────────────────

async function muteMember(member, moderator, duration, reason) {
    const MAX_DURATION = 28 * 24 * 60 * 60 * 1000;
    if (duration > MAX_DURATION) return "Duration cannot exceed 28 days.";
    if (member.id === moderator.id) return "You cannot mute yourself.";
    if (member.user.bot) return "You cannot mute bots.";
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return "You cannot mute an Administrator.";

    const modMember = member.guild.members.cache.get(moderator.id);
    if (modMember && member.roles.highest.position >= modMember.roles.highest.position)
        return "You cannot mute someone with an equal or higher role.";

    try {
        await member.timeout(duration, reason);
    } catch {
        return "I don't have permission to timeout that member. Check my role position.";
    }

    saveMute({
        userId:      member.id,
        moderatorId: moderator.id,
        guildId:     member.guild.id,
        reason,
        mutedAt:     Date.now(),
        expiresAt:   Date.now() + duration
    });

    return null; // success
}

// ─────────────────────────────────────────────────────────────────────────────
// /mute
// ─────────────────────────────────────────────────────────────────────────────

const muteCommand = {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout (mute) a user for a set duration")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName("user").setDescription("The user to mute").setRequired(true))
        .addStringOption(o => o.setName("time").setDescription("Duration: 10s · 5m · 12h · 1d (max 28d)").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the mute").setRequired(false)),

    async execute(interaction) {
        const member  = interaction.options.getMember("user");
        const timeStr = interaction.options.getString("time");
        const reason  = interaction.options.getString("reason") || "No reason provided";

        if (!member)
            return interaction.reply({ embeds: [errorEmbed("That user is not in this server.")], ephemeral: true });

        const duration = parseTime(timeStr);
        if (!duration)
            return interaction.reply({ embeds: [errorEmbed("Invalid time format. Examples: `10s`, `5m`, `12h`, `1d`")], ephemeral: true });

        const error = await muteMember(member, interaction.user, duration, reason);
        if (error)
            return interaction.reply({ embeds: [errorEmbed(error)], ephemeral: true });

        const embed = muteSuccessEmbed(member, interaction.user, timeStr, reason);
        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "mute");
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return msg.reply({ embeds: [errorEmbed("You need the **Moderate Members** permission to mute.")] });

        const target =
            msg.mentions.members.first() ||
            (args[0] ? msg.guild.members.cache.get(args[0]) : null);

        if (!target)
            return msg.reply({ embeds: [errorEmbed("User not found. Mention them or provide their ID.")] });

        const timeStr  = args[1];
        const duration = parseTime(timeStr);
        if (!duration)
            return msg.reply({ embeds: [errorEmbed("Invalid time format. Examples: `10s`, `5m`, `12h`, `1d`")] });

        const reason = args.slice(2).join(" ") || "No reason provided";

        const error = await muteMember(target, msg.author, duration, reason);
        if (error) return msg.reply({ embeds: [errorEmbed(error)] });

        const embed = muteSuccessEmbed(target, msg.author, timeStr, reason);
        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
        trackStat(msg.guild.id, msg.author.id, "mute");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /unmute
// ─────────────────────────────────────────────────────────────────────────────

const unmuteCommand = {
    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a timeout from a user early")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for unmute").setRequired(false)),

    async execute(interaction) {
        const member = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || "No reason provided";

        if (!member)
            return interaction.reply({ embeds: [errorEmbed("That user is not in this server.")], ephemeral: true });

        if (!member.isCommunicationDisabled())
            return interaction.reply({ embeds: [errorEmbed("That user is not currently muted.")], ephemeral: true });

        try {
            await member.timeout(null, reason);
        } catch (err) {
            return interaction.reply({ embeds: [errorEmbed(`Failed to unmute: ${err.message}`)], ephemeral: true });
        }

        const embed = unmuteEmbed(member, interaction.user, reason);
        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return msg.reply({ embeds: [errorEmbed("You need the **Moderate Members** permission to unmute.")] });

        const target =
            msg.mentions.members.first() ||
            (args[0] ? msg.guild.members.cache.get(args[0]) : null);

        if (!target)
            return msg.reply({ embeds: [errorEmbed("User not found. Mention them or provide their ID.")] });

        if (!target.isCommunicationDisabled())
            return msg.reply({ embeds: [errorEmbed("That user is not currently muted.")] });

        const reason = args.slice(1).join(" ") || "No reason provided";

        try {
            await target.timeout(null, reason);
        } catch (err) {
            return msg.reply({ embeds: [errorEmbed(`Failed to unmute: ${err.message}`)] });
        }

        const embed = unmuteEmbed(target, msg.author, reason);
        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
    }
};

module.exports = [muteCommand, unmuteCommand];