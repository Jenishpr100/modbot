const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const { sendToModlog, trackStat, errorEmbed } = require("../utils");

// ─────────────────────────────────────────────────────────────────────────────
// /purge — bulk delete messages
// ─────────────────────────────────────────────────────────────────────────────

const purgeCommand = {
    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Bulk delete messages in this channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(o =>
            o.setName("amount").setDescription("Number of messages to delete (1–100)").setMinValue(1).setMaxValue(100).setRequired(true)
        )
        .addUserOption(o =>
            o.setName("user").setDescription("Only delete messages from this user").setRequired(false)
        ),

    async execute(interaction) {
        const amount    = interaction.options.getInteger("amount");
        const filterUser = interaction.options.getUser("user");

        await interaction.deferReply({ ephemeral: true });

        let messages = await interaction.channel.messages.fetch({ limit: 100 });

        // Filter to target user if specified
        if (filterUser) messages = messages.filter(m => m.author.id === filterUser.id);

        // Only messages < 14 days old (Discord limit for bulk delete)
        const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        messages = messages.filter(m => m.createdTimestamp > cutoff).first(amount);

        if (!messages.length)
            return interaction.editReply({ embeds: [errorEmbed("No messages found to delete (messages older than 14 days cannot be bulk deleted).")] });

        let deleted;
        try {
            deleted = await interaction.channel.bulkDelete(messages, true);
        } catch (err) {
            return interaction.editReply({ embeds: [errorEmbed(`Failed to delete messages: ${err.message}`)] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle("🧹 Messages Purged")
            .addFields(
                { name: "Channel",   value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Deleted",   value: `${deleted.size} message(s)`,   inline: true },
                { name: "Moderator", value: `<@${interaction.user.id}>`,     inline: true }
            )
            .setTimestamp();

        if (filterUser) embed.addFields({ name: "Filter", value: `Messages by <@${filterUser.id}>` });

        await interaction.editReply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "purge");
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageMessages))
            return msg.reply({ embeds: [errorEmbed("You need the **Manage Messages** permission.")] });

        const amount = parseInt(args[0], 10);
        if (isNaN(amount) || amount < 1 || amount > 100)
            return msg.reply({ embeds: [errorEmbed("Please provide a number between 1 and 100.\nUsage: `!!purge <amount>`")] });

        try {
            // +1 to also delete the command message itself
            const deleted = await msg.channel.bulkDelete(amount + 1, true);

            const embed = new EmbedBuilder()
                .setColor(0x9B59B6)
                .setTitle("🧹 Messages Purged")
                .addFields(
                    { name: "Channel",   value: `<#${msg.channel.id}>`,         inline: true },
                    { name: "Deleted",   value: `${deleted.size - 1} message(s)`, inline: true },
                    { name: "Moderator", value: `<@${msg.author.id}>`,           inline: true }
                )
                .setTimestamp();

            const reply = await msg.channel.send({ embeds: [embed] });
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            await sendToModlog(msg.guild, embed);
            trackStat(msg.guild.id, msg.author.id, "purge");
        } catch (err) {
            msg.reply({ embeds: [errorEmbed(`Failed to delete messages: ${err.message}`)] });
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /slowmode — set channel slowmode
// ─────────────────────────────────────────────────────────────────────────────

const slowmodeCommand = {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Set the slowmode for this channel (0 to disable)")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addIntegerOption(o =>
            o.setName("seconds").setDescription("Seconds between messages (0–21600)").setMinValue(0).setMaxValue(21600).setRequired(true)
        ),

    async execute(interaction) {
        const seconds = interaction.options.getInteger("seconds");

        try {
            await interaction.channel.setRateLimitPerUser(seconds);
        } catch (err) {
            return interaction.reply({ embeds: [errorEmbed(`Failed to set slowmode: ${err.message}`)], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("⏱️ Slowmode Updated")
            .addFields(
                { name: "Channel",   value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Slowmode",  value: seconds === 0 ? "Disabled" : `${seconds}s`, inline: true },
                { name: "Moderator", value: `<@${interaction.user.id}>`,     inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "slowmode");
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return msg.reply({ embeds: [errorEmbed("You need the **Manage Channels** permission.")] });

        const seconds = parseInt(args[0], 10);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600)
            return msg.reply({ embeds: [errorEmbed("Please provide a number between 0 and 21600.\nUsage: `!!slowmode <seconds>`")] });

        try {
            await msg.channel.setRateLimitPerUser(seconds);
        } catch (err) {
            return msg.reply({ embeds: [errorEmbed(`Failed to set slowmode: ${err.message}`)] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle("⏱️ Slowmode Updated")
            .addFields(
                { name: "Channel",   value: `<#${msg.channel.id}>`,             inline: true },
                { name: "Slowmode",  value: seconds === 0 ? "Disabled" : `${seconds}s`, inline: true },
                { name: "Moderator", value: `<@${msg.author.id}>`,              inline: true }
            )
            .setTimestamp();

        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
        trackStat(msg.guild.id, msg.author.id, "slowmode");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /lock  /unlock — lock or unlock a channel
// ─────────────────────────────────────────────────────────────────────────────

const lockCommand = {
    data: new SlashCommandBuilder()
        .setName("lock")
        .setDescription("Prevent @everyone from sending messages in this channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o.setName("reason").setDescription("Reason for locking").setRequired(false)),

    async execute(interaction) {
        const reason = interaction.options.getString("reason") || "No reason provided";

        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: false
            });
        } catch (err) {
            return interaction.reply({ embeds: [errorEmbed(`Failed to lock: ${err.message}`)], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle("🔒 Channel Locked")
            .addFields(
                { name: "Channel",   value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Moderator", value: `<@${interaction.user.id}>`,     inline: true },
                { name: "Reason",    value: reason }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "lock");
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return msg.reply({ embeds: [errorEmbed("You need the **Manage Channels** permission.")] });

        const reason = args.join(" ") || "No reason provided";

        try {
            await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
        } catch (err) {
            return msg.reply({ embeds: [errorEmbed(`Failed to lock: ${err.message}`)] });
        }

        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle("🔒 Channel Locked")
            .addFields(
                { name: "Channel",   value: `<#${msg.channel.id}>`,  inline: true },
                { name: "Moderator", value: `<@${msg.author.id}>`,   inline: true },
                { name: "Reason",    value: reason }
            )
            .setTimestamp();

        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
        trackStat(msg.guild.id, msg.author.id, "lock");
    }
};

const unlockCommand = {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Restore @everyone's ability to send messages in this channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o.setName("reason").setDescription("Reason for unlocking").setRequired(false)),

    async execute(interaction) {
        const reason = interaction.options.getString("reason") || "No reason provided";

        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                SendMessages: null  // revert to role default
            });
        } catch (err) {
            return interaction.reply({ embeds: [errorEmbed(`Failed to unlock: ${err.message}`)], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("🔓 Channel Unlocked")
            .addFields(
                { name: "Channel",   value: `<#${interaction.channel.id}>`, inline: true },
                { name: "Moderator", value: `<@${interaction.user.id}>`,     inline: true },
                { name: "Reason",    value: reason }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        await sendToModlog(interaction.guild, embed);
        trackStat(interaction.guild.id, interaction.user.id, "unlock");
    },

    async onMessage(msg, args) {
        if (!msg.member.permissions.has(PermissionFlagsBits.ManageChannels))
            return msg.reply({ embeds: [errorEmbed("You need the **Manage Channels** permission.")] });

        const reason = args.join(" ") || "No reason provided";

        try {
            await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: null });
        } catch (err) {
            return msg.reply({ embeds: [errorEmbed(`Failed to unlock: ${err.message}`)] });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("🔓 Channel Unlocked")
            .addFields(
                { name: "Channel",   value: `<#${msg.channel.id}>`, inline: true },
                { name: "Moderator", value: `<@${msg.author.id}>`,  inline: true },
                { name: "Reason",    value: reason }
            )
            .setTimestamp();

        await msg.reply({ embeds: [embed] });
        await sendToModlog(msg.guild, embed);
        trackStat(msg.guild.id, msg.author.id, "unlock");
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /userinfo — show information about a user
// ─────────────────────────────────────────────────────────────────────────────

const userinfoCommand = {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("Display information about a user")
        .addUserOption(o => o.setName("user").setDescription("User to look up").setRequired(false)),

    async execute(interaction) {
        const targetUser   = interaction.options.getUser("user") ?? interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        const createdAt = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`;
        const joinedAt  = targetMember
            ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`
            : "Not in server";

        const roles = targetMember
            ? targetMember.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`)
                .slice(0, 10)
                .join(" ") || "None"
            : "N/A";

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`👤 User Info — ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "Username",    value: targetUser.username,                                     inline: true },
                { name: "ID",          value: targetUser.id,                                           inline: true },
                { name: "Bot",         value: targetUser.bot ? "Yes" : "No",                           inline: true },
                { name: "Account Created", value: createdAt,                                           inline: false },
                { name: "Joined Server",   value: joinedAt,                                            inline: false },
                { name: `Roles (${targetMember?.roles.cache.size - 1 ?? 0})`, value: roles,           inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        if (targetMember?.nickname) embed.addFields({ name: "Nickname", value: targetMember.nickname, inline: true });

        await interaction.reply({ embeds: [embed] });
    },

    async onMessage(msg, args) {
        const targetMember =
            msg.mentions.members.first() ||
            (args[0] ? await msg.guild.members.fetch(args[0]).catch(() => null) : msg.member);

        if (!targetMember) return msg.reply({ embeds: [errorEmbed("User not found.")] });

        const targetUser = targetMember.user;
        const createdAt  = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F>`;
        const joinedAt   = `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`;
        const roles      = targetMember.roles.cache
            .filter(r => r.id !== msg.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => `<@&${r.id}>`)
            .slice(0, 10)
            .join(" ") || "None";

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`👤 User Info — ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: "Username",        value: targetUser.username,   inline: true },
                { name: "ID",              value: targetUser.id,         inline: true },
                { name: "Bot",             value: targetUser.bot ? "Yes" : "No", inline: true },
                { name: "Account Created", value: createdAt,             inline: false },
                { name: "Joined Server",   value: joinedAt,              inline: false },
                { name: `Roles (${targetMember.roles.cache.size - 1})`, value: roles, inline: false }
            )
            .setFooter({ text: `Requested by ${msg.author.username}` })
            .setTimestamp();

        if (targetMember.nickname) embed.addFields({ name: "Nickname", value: targetMember.nickname, inline: true });

        await msg.reply({ embeds: [embed] });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /serverinfo — show server statistics
// ─────────────────────────────────────────────────────────────────────────────

const serverinfoCommand = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("Display information about this server"),

    async execute(interaction) {
        const guild = interaction.guild;
        await guild.members.fetch(); // ensure cache is populated

        const totalMembers  = guild.memberCount;
        const bots          = guild.members.cache.filter(m => m.user.bot).size;
        const humans        = totalMembers - bots;
        const textChannels  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const roles         = guild.roles.cache.size - 1; // subtract @everyone
        const createdAt     = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🏠 Server Info — ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: "Owner",          value: `<@${guild.ownerId}>`,          inline: true },
                { name: "Server ID",      value: guild.id,                       inline: true },
                { name: "Created",        value: createdAt,                      inline: false },
                { name: "Members",        value: `👥 ${humans} humans · 🤖 ${bots} bots`, inline: true },
                { name: "Channels",       value: `💬 ${textChannels} text · 🔊 ${voiceChannels} voice`, inline: true },
                { name: "Roles",          value: `🏷️ ${roles}`,                  inline: true },
                { name: "Boost Level",    value: `⚡ Level ${guild.premiumTier}`, inline: true },
                { name: "Boosts",         value: `${guild.premiumSubscriptionCount ?? 0}`, inline: true },
            )
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },

    async onMessage(msg) {
        const guild = msg.guild;
        await guild.members.fetch();

        const totalMembers  = guild.memberCount;
        const bots          = guild.members.cache.filter(m => m.user.bot).size;
        const humans        = totalMembers - bots;
        const textChannels  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const roles         = guild.roles.cache.size - 1;
        const createdAt     = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`🏠 Server Info — ${guild.name}`)
            .setThumbnail(guild.iconURL({ size: 256 }))
            .addFields(
                { name: "Owner",       value: `<@${guild.ownerId}>`,                       inline: true },
                { name: "Server ID",   value: guild.id,                                    inline: true },
                { name: "Created",     value: createdAt,                                   inline: false },
                { name: "Members",     value: `👥 ${humans} humans · 🤖 ${bots} bots`,    inline: true },
                { name: "Channels",    value: `💬 ${textChannels} text · 🔊 ${voiceChannels} voice`, inline: true },
                { name: "Roles",       value: `🏷️ ${roles}`,                               inline: true },
                { name: "Boost Level", value: `⚡ Level ${guild.premiumTier}`,             inline: true },
                { name: "Boosts",      value: `${guild.premiumSubscriptionCount ?? 0}`,    inline: true },
            )
            .setFooter({ text: `Requested by ${msg.author.username}` })
            .setTimestamp();

        await msg.reply({ embeds: [embed] });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// /note — add a private mod note to a user (stored, not shown to user)
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require("fs");
const path = require("path");

const NOTES_FILE = path.join(__dirname, "notes.json");
if (!fs.existsSync(NOTES_FILE)) fs.writeFileSync(NOTES_FILE, "{}");

function loadNotes() {
    try { return JSON.parse(fs.readFileSync(NOTES_FILE, "utf8")); } catch { return {}; }
}
function saveNotes(data) { fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2)); }

const noteCommand = {
    data: new SlashCommandBuilder()
        .setName("note")
        .setDescription("Add or view private moderator notes on a user")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommandGroup(g =>
            g.setName("manage")
             .setDescription("Manage notes")
             .addSubcommand(s =>
                 s.setName("add")
                  .setDescription("Add a note to a user")
                  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
                  .addStringOption(o => o.setName("text").setDescription("Note text").setRequired(true))
             )
             .addSubcommand(s =>
                 s.setName("view")
                  .setDescription("View notes for a user")
                  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
             )
             .addSubcommand(s =>
                 s.setName("clear")
                  .setDescription("Clear all notes for a user")
                  .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
             )
        ),

    async execute(interaction) {
        const sub        = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser("user");
        const guildId    = interaction.guild.id;
        const notes      = loadNotes();

        if (!notes[guildId])              notes[guildId] = {};
        if (!notes[guildId][targetUser.id]) notes[guildId][targetUser.id] = [];

        if (sub === "add") {
            const text = interaction.options.getString("text");
            notes[guildId][targetUser.id].push({
                text,
                moderatorId: interaction.user.id,
                timestamp:   Date.now()
            });
            saveNotes(notes);
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xF39C12)
                        .setTitle("📝 Note Added")
                        .setDescription(`Note added to **${targetUser.username}**.`)
                        .addFields({ name: "Note", value: text })
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        if (sub === "view") {
            const userNotes = notes[guildId][targetUser.id];
            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`📋 Notes — ${targetUser.username}`)
                .setFooter({ text: `Total: ${userNotes.length}` })
                .setTimestamp();

            if (userNotes.length === 0) {
                embed.setDescription("No notes for this user.");
            } else {
                for (const n of userNotes.slice(-10).reverse()) {
                    const date = `<t:${Math.floor(n.timestamp / 1000)}:R>`;
                    embed.addFields({ name: `By <@${n.moderatorId}> · ${date}`, value: n.text });
                }
            }
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === "clear") {
            notes[guildId][targetUser.id] = [];
            saveNotes(notes);
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle("🗑️ Notes Cleared")
                        .setDescription(`All notes for **${targetUser.username}** have been cleared.`)
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }
    }
};

module.exports = [
    purgeCommand,
    slowmodeCommand,
    lockCommand,
    unlockCommand,
    userinfoCommand,
    serverinfoCommand,
    noteCommand,
];