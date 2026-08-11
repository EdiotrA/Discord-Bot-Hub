const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const axios = require('axios');
module.exports = {
  data: new SlashCommandBuilder().setName('meme').setDescription('Get a random meme'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://meme-api.com/gimme', { timeout: 5000 });
      const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle(data.title).setImage(data.url).setFooter({ text: `👍 ${data.ups} • r/${data.subreddit}` }).setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch { await interaction.editReply({ embeds: [Embed.error('Error', 'Could not fetch a meme right now. Try again!')] }); }
  },
};
