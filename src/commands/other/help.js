const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show command list from website'),

    async execute(interaction) {
        try {
            const res = await fetch('https://jenishpr100.github.io/modbot/commandlist.md');
            const text = await res.text();

            const content = text.length > 4000 
                ? text.slice(0, 4000) + "\n\n... (truncated)" 
                : text;

            const embed = new EmbedBuilder()
                .setTitle("📜 Help Menu")
                .setDescription(content)
                .setColor("Blue");

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "❌ Failed to load help menu.", ephemeral: true });
        }
    }
};