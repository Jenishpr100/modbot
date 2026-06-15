const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { getStats, getAllStats, errorEmbed } = require("../utils");

// Stat labels and emojis
const STAT_LABELS = {
    warn:     { label: "Warnings",  emoji: "⚠️" },
    kick:     { label: "Kicks",     emoji: "👢" },
    ban:      { label: "Bans",      emoji: "🔨" },
    mute:     { label: "Mutes",     emoji: "🔇" },
    purge:    { label: "Purges",    emoji: "🧹" },
    slowmode: { label: "Slowmodes", emoji: "⏱️" },
    lock:     { label: "Locks",     emoji: "🔒" },
    unlock:   { label: "Unlocks",   emoji: "🔓" },
};

// Only show these in the stats (not unwarn/unban/unmute)
const DISPLAY_KEYS = ["warn", "kick", "ban", "mute", "purge", "slowmode", "lock", "unlock"];

function buildStatFields(stats) {
    return DISPLAY_KEYS
        .filter(k => (stats[k] ?? 0) > 0)
        .map(k => ({
            name:   `${STAT_LABELS[k]?.emoji ?? "•"} ${STAT_LABELS[k]?.label ?? k}`,
            value:  `**${stats[k]}**`,
            inline: true
        }));
}

function totalActions(stats) {
    return DISPLAY_KEYS.reduce((sum, k) => sum + (stats[k] ?? 0), 0);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("modstats")
        .setDescription("View moderation statistics for yourself or another moderator")
        .addUserOption(o =>
            o.setName("mod").setDescription("Moderator to look up (leave blank for yourself)").setRequired(false)
        ),

    async execute(interaction) {
        // Must have ModerateMembers to use this command at all
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return interaction.reply({ embeds: [errorEmbed("You need the **Moderate Members** permission to use this command.")], ephemeral: true });

        const targetUser = interaction.options.getUser("mod") ?? interaction.user;
        const stats      = getStats(interaction.guild.id, targetUser.id);

        // User must have at least one tracked action to appear
        if (!stats || totalActions(stats) === 0) {
            const isSelf = targetUser.id === interaction.user.id;
            return interaction.reply({
                embeds: [errorEmbed(isSelf
                    ? "You don't have any moderation actions recorded yet."
                    : `**${targetUser.username}** has no moderation actions recorded.`
                )],
                ephemeral: true
            });
        }

        const fields = buildStatFields(stats);
        const total  = totalActions(stats);

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`📊 Mod Stats — ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(...fields)
            .setFooter({ text: `Total tracked actions: ${total}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    // ── Leaderboard variant: !!modstats  ──────────────────────────────────
    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ModerateMembers))
            return msg.reply({ embeds: [errorEmbed("You need the **Moderate Members** permission to use this command.")] });

        const allStats = getAllStats(msg.guild.id);
        const entries  = Object.entries(allStats)
            .map(([id, s]) => ({ id, total: totalActions(s), stats: s }))
            .filter(e => e.total > 0)
            .sort((a, b) => b.total - a.total);

        if (entries.length === 0)
            return msg.reply({ embeds: [errorEmbed("No moderation actions recorded yet for this server.")] });

        const lines = await Promise.all(
            entries.slice(0, 10).map(async (e, i) => {
                let name = e.id;
                try {
                    const user = await msg.client.users.fetch(e.id);
                    name = user.username;
                } catch {}

                const parts = DISPLAY_KEYS
                    .filter(k => (e.stats[k] ?? 0) > 0)
                    .map(k => `${STAT_LABELS[k].emoji}${e.stats[k]}`);

                return `**${i + 1}.** ${name} — ${parts.join(" · ")} *(${e.total} total)*`;
            })
        );

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle("📊 Mod Stats Leaderboard")
            .setDescription(lines.join("\n"))
            .setFooter({ text: `Showing top ${entries.slice(0, 10).length} moderators` })
            .setTimestamp();

        await msg.reply({ embeds: [embed] });
    }
};