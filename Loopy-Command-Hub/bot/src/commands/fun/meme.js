const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const axios = require('axios');
module.exports = {
  data: new SlashCommandBuilder().setName('meme').setDescription('Get a random meme'),
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const { data } = await axios.get('https://meme-api.com/gimme', { timeout: 5000 });
      const embed = new EmbedBuilder()
        .setColor(config.colors.purple)
        .setTitle(`🖼️  ${data.title}`)
        .setURL(data.postLink || null)
        .addFields(
          { name: '📍 Subreddit', value: `\`r/${data.subreddit}\``, inline: true },
          { name: '👍 Upvotes', value: `\`${Number(data.ups || 0).toLocaleString()}\``, inline: true },
        )
        .setImage(data.url)
        .setFooter(Embed.brandFooter('Fresh from Reddit'))
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
    } catch { await interaction.editReply({ embeds: [Embed.error('Error', 'Could not fetch a meme right now. Try again!')] }); }
  },
};
