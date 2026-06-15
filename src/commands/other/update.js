const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updates')
        .setDescription('Shows latest ModBot version from website'),

    async execute(interaction) {

        try {
            const res = await fetch(
                "https://raw.githubusercontent.com/Jenishpr100/modbot/main/ReadME.md"
            );

            const text = await res.text();

            // find version anywhere in file
            const match = text.match(/v\d+\.\d+\.\d+/i);
            const version = match ? match[0] : "Unknown";

            const embed = new EmbedBuilder()
                .setColor("Blue")
                .setTitle("🛡️ ModBot Updates")
                .setURL("https://jenishpr100.github.io/modbot/Updates")
                .setDescription(`**Current Version:** ${version}`)
                .addFields({
                    name: "Status",
                    value: "Fetched from GitHub README"
                })
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);

            await interaction.reply({
                content: "❌ Failed to fetch updates.",
                ephemeral: true
            });
        }
    }
};