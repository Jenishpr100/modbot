const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require("discord.js");

const { setModlogChannel, getModlogChannelId, errorEmbed } = require("../utils");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("modlog")
        .setDescription("Set or view the moderation log channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(o =>
            o.setName("channel")
             .setDescription("Channel to send moderation logs to (leave blank to view current)")
             .addChannelTypes(ChannelType.GuildText)
             .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator))
            return interaction.reply({ embeds: [errorEmbed("You need **Administrator** to configure modlog.")], ephemeral: true });

        const channel = interaction.options.getChannel("channel");

        if (!channel) {
            const currentId = getModlogChannelId(interaction.guild.id);
            if (!currentId)
                return interaction.reply({ embeds: [errorEmbed("No modlog channel is set. Use `/modlog #channel` to set one.")], ephemeral: true });

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x3498DB)
                        .setTitle("📋 Modlog Channel")
                        .setDescription(`Current modlog channel: <#${currentId}>`)
                        .setTimestamp()
                ],
                ephemeral: true
            });
        }

        setModlogChannel(interaction.guild.id, channel.id);

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle("✅ Modlog Channel Set")
            .setDescription(`All moderation actions will now be logged in <#${channel.id}>.`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Confirm in the log channel itself
        try {
            await channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x3498DB)
                        .setTitle("📋 Modlog Activated")
                        .setDescription("This channel has been set as the moderation log. All mod actions will appear here.")
                        .setFooter({ text: `Set by ${interaction.user.username}` })
                        .setTimestamp()
                ]
            });
        } catch {}
    }
};