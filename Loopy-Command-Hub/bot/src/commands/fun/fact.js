const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const axios = require('axios');
const render = (text) => Embed.base({
  color: config.colors.info,
  title: '🤓 Did You Know?',
  description: `> ${text}`,
  footer: 'A little knowledge for your day',
});
module.exports = {
  data: new SlashCommandBuilder().setName('fact').setDescription('Get a random fun fact'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 5000 });
      await interaction.editReply({ embeds: [render(data.text)] });
    } catch { await interaction.editReply({ embeds: [render('Honey never spoils. Archaeologists have found 3,000-year-old honey in Egyptian tombs!')] }); }
  },
};
