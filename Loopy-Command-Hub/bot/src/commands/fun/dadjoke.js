const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const axios = require('axios');
const render = (joke) => Embed.base({
  color: config.colors.game,
  title: '👨 Dad Joke',
  description: `> *${joke}*`,
  footer: 'Groan-worthy, guaranteed',
});
module.exports = {
  data: new SlashCommandBuilder().setName('dadjoke').setDescription('Get a random dad joke'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 5000 });
      await interaction.editReply({ embeds: [render(data.joke)] });
    } catch { await interaction.editReply({ embeds: [render('I\'m reading a book about anti-gravity. It\'s impossible to put down!')] }); }
  },
};
