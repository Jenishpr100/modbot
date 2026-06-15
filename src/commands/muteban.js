const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const { sendToModlog, trackStat, errorEmbed } = require("../utils");

// ── Embed builders ─────────────────────────────────────────────────────────

function kickEmbed(targetUser, moderator, reason) {
    return new EmbedBuilder()
        .setColor(0xE67E22)
        .setTitle("👢 User Kicked")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: "User",      value: `${targetUser.username ?? targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: "Moderator", value: `${moderator.username ?? moderator.tag} (<@${moderator.id}>)`,    inline: true },
            { name: "Reason",    value: reason }
        )
        .setFooter({ text: `User ID: ${targetUser.id}` })
        .setTimestamp();
}

function banEmbed(targetUser, moderator, reason, deletedays) {
    return new EmbedBuilder()
        .setColor(0xC0392B)
        .setTitle("🔨 User Banned")
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: "User",             value: `${targetUser.username ?? targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: "Moderator",        value: `${moderator.username ?? moderator.tag} (<@${moderator.id}>)`,    inline: true },
            { name: "Messages Deleted", value: deletedays === 0 ? "None" : `${deletedays} day(s)`,               inline: true },
            { name: "Reason",           value: reason }
        )
        .setFooter({ text: `User ID: ${targetUser.id}` })
        .setTimestamp();
}

function unbanEmbed(targetUser, moderator, reason) {
    return new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle("✅ User Unbanned")
        .addFields(
            { name: "User",      value: `${targetUser.username ?? targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: "Moderator", value: `${moderator.username ?? moderator.tag} (<@${moderator.id}>)`,    inline: true },
            { name: "Reason",    value: reason }
        )
        .setFooter({ text: `User ID: ${targetUser.id}` })
        .setTimestamp();
}

// ── Role hierarchy check ───────────────────────────────────────────────────

function checkHierarchy(moderatorMember, targetMember, action) {
    if (targetMember.id === targetMember.guild.ownerId)
        return `You cannot ${action} the server owner.`;

    const botMember = targetMember.guild.members.me;
    if (botMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0)
        return `I don't have a high enough role to ${action} **${targetMember.user.username ?? targetMember.user.tag}**.`;

    if (moderatorMember.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0)
        return `You cannot ${action} someone with an equal or higher role than you.`;

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// /kick
// ─────────────────────────────────────────────────────────────────────────────

const kickCommand = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a user from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the kick").setRequired(false)),

    async execute(interaction) {
        const targetMember = interaction.options.getMember("user");
        const reason       = interaction.options.getString("reason") || "No reason provided";

        if (!targetMember) return interaction.reply({ embeds: [errorEmbed("That user is not in this server.")], ephemeral: true });
        if (targetMember.user.bot) return interaction.reply({ embeds: [errorEmbed("You cannot kick bots.")], ephemeral: true });
        if (targetMember.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed("You cannot kick yourself.")], ephemeral: true });

        const hierarchyError = checkHierarchy(interaction.member, targetMember, "kick");
        if (hierarchyError) return interaction.reply({ embeds: [errorEmbed(hierarchyError)], ephemeral: true });

        if (!targetMember.kickable)
            return interaction.reply({ embeds: [errorEmbed("I am unable to kick this user. They may have a higher role than me.")], ephemeral: true });

        try {
            await targetMember.kick(reason);
            const embed = kickEmbed(targetMember.user, interaction.user, reason);
            await interaction.reply({ embeds: [embed] });
            await sendToModlog(interaction.guild, embed);
            trackStat(interaction.guild.id, interaction.user.id, "kick");
        } catch (err) {
            console.error("❌ kick failed:", err);
            await interaction.reply({ embeds: [errorEmbed(`Failed to kick the user: ${err.message}`)], ephemeral: true });
        }
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.KickMembers))
            return msg.reply({ embeds: [errorEmbed("You need the **Kick Members** permission to use this command.")] });

        const targetMember =
            msg.mentions.members.first() ||
            (args[0] ? await msg.guild.members.fetch(args[0]).catch(() => null) : null);

        if (!targetMember) return msg.reply({ embeds: [errorEmbed("User not found. Mention them or provide their ID.\nUsage: `!!kick @user [reason]`")] });
        if (targetMember.user.bot) return msg.reply({ embeds: [errorEmbed("You cannot kick bots.")] });
        if (targetMember.id === msg.author.id) return msg.reply({ embeds: [errorEmbed("You cannot kick yourself.")] });

        const hierarchyError = checkHierarchy(msg.member, targetMember, "kick");
        if (hierarchyError) return msg.reply({ embeds: [errorEmbed(hierarchyError)] });

        if (!targetMember.kickable)
            return msg.reply({ embeds: [errorEmbed("I am unable to kick this user. They may have a higher role than me.")] });

        const reason = args.slice(1).join(" ") || "No reason provided";

        try {
            await targetMember.kick(reason);
            const embed = kickEmbed(targetMember.user, msg.author, reason);
            await msg.reply({ embeds: [embed] });
            await sendToModlog(msg.guild, embed);
            trackStat(msg.guild.id, msg.author.id, "kick");
        } catch (err) {
            console.error("❌ kick failed:", err);
            await msg.reply({ embeds: [errorEmbed(`Failed to kick the user: ${err.message}`)] });
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /ban
// ─────────────────────────────────────────────────────────────────────────────

const banCommand = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the ban").setRequired(false))
        .addIntegerOption(o =>
            o.setName("deletedays").setDescription("Days of messages to delete (0–7, default 0)")
             .setMinValue(0).setMaxValue(7).setRequired(false)
        ),

    async execute(interaction) {
        const targetUser   = interaction.options.getUser("user");
        const targetMember = interaction.options.getMember("user");
        const reason       = interaction.options.getString("reason") || "No reason provided";
        const deletedays   = interaction.options.getInteger("deletedays") ?? 0;

        if (!targetUser) return interaction.reply({ embeds: [errorEmbed("Could not resolve that user.")], ephemeral: true });
        if (targetUser.bot) return interaction.reply({ embeds: [errorEmbed("You cannot ban bots.")], ephemeral: true });
        if (targetUser.id === interaction.user.id) return interaction.reply({ embeds: [errorEmbed("You cannot ban yourself.")], ephemeral: true });

        if (targetMember) {
            const hierarchyError = checkHierarchy(interaction.member, targetMember, "ban");
            if (hierarchyError) return interaction.reply({ embeds: [errorEmbed(hierarchyError)], ephemeral: true });
            if (!targetMember.bannable)
                return interaction.reply({ embeds: [errorEmbed("I am unable to ban this user. They may have a higher role than me.")], ephemeral: true });
        }

        try {
            await interaction.guild.members.ban(targetUser.id, { reason, deleteMessageDays: deletedays });
            const embed = banEmbed(targetUser, interaction.user, reason, deletedays);
            await interaction.reply({ embeds: [embed] });
            await sendToModlog(interaction.guild, embed);
            trackStat(interaction.guild.id, interaction.user.id, "ban");
        } catch (err) {
            console.error("❌ ban failed:", err);
            await interaction.reply({ embeds: [errorEmbed(`Failed to ban the user: ${err.message}`)], ephemeral: true });
        }
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.BanMembers))
            return msg.reply({ embeds: [errorEmbed("You need the **Ban Members** permission to use this command.")] });

        const targetMember =
            msg.mentions.members.first() ||
            (args[0] ? await msg.guild.members.fetch(args[0]).catch(() => null) : null);

        const targetUser =
            targetMember?.user ||
            (args[0] ? await msg.client.users.fetch(args[0]).catch(() => null) : null);

        if (!targetUser) return msg.reply({ embeds: [errorEmbed("User not found. Mention them or provide their ID.\nUsage: `!!ban @user [reason]`")] });
        if (targetUser.bot) return msg.reply({ embeds: [errorEmbed("You cannot ban bots.")] });
        if (targetUser.id === msg.author.id) return msg.reply({ embeds: [errorEmbed("You cannot ban yourself.")] });

        if (targetMember) {
            const hierarchyError = checkHierarchy(msg.member, targetMember, "ban");
            if (hierarchyError) return msg.reply({ embeds: [errorEmbed(hierarchyError)] });
            if (!targetMember.bannable)
                return msg.reply({ embeds: [errorEmbed("I am unable to ban this user. They may have a higher role than me.")] });
        }

        const reason = args.slice(1).join(" ") || "No reason provided";

        try {
            await msg.guild.members.ban(targetUser.id, { reason, deleteMessageDays: 0 });
            const embed = banEmbed(targetUser, msg.author, reason, 0);
            await msg.reply({ embeds: [embed] });
            await sendToModlog(msg.guild, embed);
            trackStat(msg.guild.id, msg.author.id, "ban");
        } catch (err) {
            console.error("❌ ban failed:", err);
            await msg.reply({ embeds: [errorEmbed(`Failed to ban the user: ${err.message}`)] });
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /unban
// ─────────────────────────────────────────────────────────────────────────────

const unbanCommand = {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user by their ID")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(o => o.setName("userid").setDescription("User ID to unban").setRequired(true))
        .addStringOption(o => o.setName("reason").setDescription("Reason for the unban").setRequired(false)),

    async execute(interaction) {
        const userId = interaction.options.getString("userid").trim();
        const reason = interaction.options.getString("reason") || "No reason provided";

        if (!/^\d{17,20}$/.test(userId))
            return interaction.reply({ embeds: [errorEmbed("Please provide a valid Discord user ID.")], ephemeral: true });

        let targetUser = null;
        try { targetUser = await interaction.client.users.fetch(userId); } catch {}

        try {
            await interaction.guild.members.unban(userId, reason);
        } catch (err) {
            return interaction.reply({ embeds: [errorEmbed(`Failed to unban: ${err.message}`)], ephemeral: true });
        }

        const embed = unbanEmbed(
            targetUser ?? { id: userId, username: `Unknown (${userId})`, tag: `Unknown (${userId})`, displayAvatarURL: () => null },
            interaction.user,
            reason
        );
        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "unban");
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.BanMembers))
            return msg.reply({ embeds: [errorEmbed("You need the **Ban Members** permission to unban.")] });

        const userId = args[0]?.trim();
        if (!userId || !/^\d{17,20}$/.test(userId))
            return msg.reply({ embeds: [errorEmbed("Please provide a valid Discord user ID.\nUsage: `!!unban <userId> [reason]`")] });

        const reason = args.slice(1).join(" ") || "No reason provided";

        let targetUser = null;
        try { targetUser = await msg.client.users.fetch(userId); } catch {}

        try {
            await msg.guild.members.unban(userId, reason);
        } catch (err) {
            return msg.reply({ embeds: [errorEmbed(`Failed to unban: ${err.message}`)] });
        }

        const embed = unbanEmbed(
            targetUser ?? { id: userId, username: `Unknown (${userId})`, tag: `Unknown (${userId})`, displayAvatarURL: () => null },
            msg.author,
            reason
        );
        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
        trackStat(msg.guild.id, msg.author.id, "unban");
    }
};

module.exports = [kickCommand, banCommand, unbanCommand];