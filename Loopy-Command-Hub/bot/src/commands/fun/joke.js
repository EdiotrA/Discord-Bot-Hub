const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const axios = require('axios');
module.exports = {
  data: new SlashCommandBuilder().setName('joke').setDescription('Get a random joke'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 5000 });
      await interaction.editReply({ embeds: [Embed.game('😄 Joke', `**${data.setup}**\n\n||${data.punchline}||`)] });
    } catch { await interaction.editReply({ embeds: [Embed.game('😄 Joke', 'Why do programmers prefer dark mode?\n\n||Because light attracts bugs!||')] }); }
  },
};
