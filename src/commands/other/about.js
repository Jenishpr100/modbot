const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Learn more about the bot'),

    async execute(interaction) {
        try {
            const res = await fetch('https://jenishpr100.github.io/modbot/About.md');
            const text = await res.text();

            // embed limit safety
            const content = text.length > 4000
                ? text.slice(0, 4000) + "\n\n... (truncated)"
                : text;

            const embed = new EmbedBuilder()
                .setTitle("📖 About Loopconomy")
                .setDescription(content)
                .setColor("Purple");

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: "❌ Failed to load about page.",
                ephemeral: true
            });
        }
    }
};
