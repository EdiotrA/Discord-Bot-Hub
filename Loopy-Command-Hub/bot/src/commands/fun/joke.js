const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const axios = require('axios');
const render = (setup, punchline) => Embed.base({
  color: config.colors.game,
  title: '😄 Random Joke',
  description: [
    '> **Setup**',
    `> ${setup}`,
    '',
    '> **Punchline** *(tap to reveal)*',
    `> ||${punchline}||`,
  ].join('\n'),
  footer: 'Ba dum tss',
});
module.exports = {
  data: new SlashCommandBuilder().setName('joke').setDescription('Get a random joke'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 5000 });
      await interaction.editReply({ embeds: [render(data.setup, data.punchline)] });
    } catch { await interaction.editReply({ embeds: [render('Why do programmers prefer dark mode?', 'Because light attracts bugs!')] }); }
  },
};
