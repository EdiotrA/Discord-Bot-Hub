const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const axios = require('axios');
module.exports = {
  data: new SlashCommandBuilder().setName('dadjoke').setDescription('Get a random dad joke'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 5000 });
      await interaction.editReply({ embeds: [Embed.game('👨 Dad Joke', data.joke)] });
    } catch { await interaction.editReply({ embeds: [Embed.game('👨 Dad Joke', 'I\'m reading a book about anti-gravity. It\'s impossible to put down!')] }); }
  },
};
