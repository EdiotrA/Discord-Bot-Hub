const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const axios = require('axios');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('trivia').setDescription('Play a trivia question')
    .addStringOption(o => o.setName('category').setDescription('Category').setRequired(false)
      .addChoices({ name: 'General', value: '9' }, { name: 'Science', value: '17' }, { name: 'History', value: '23' }, { name: 'Gaming', value: '15' }, { name: 'Sports', value: '21' })),
  async execute(interaction) {
    await interaction.deferReply();
    const cat = interaction.options.getString('category') || '9';
    try {
      const { data } = await axios.get(`https://opentdb.com/api.php?amount=1&type=multiple&category=${cat}`, { timeout: 8000 });
      const q = data.results[0];
      const decode = s => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
      const correct = decode(q.correct_answer);
      const allAnswers = [...q.incorrect_answers.map(decode), correct].sort(() => Math.random() - 0.5);
      const letters = ['A', 'B', 'C', 'D'];
      const correctIdx = allAnswers.indexOf(correct);

      const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('🎯 Trivia!')
        .addFields({ name: 'Category', value: decode(q.category), inline: true }, { name: 'Difficulty', value: q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1), inline: true }, { name: 'Question', value: decode(q.question) })
        .setFooter({ text: '30 seconds to answer!' }).setTimestamp();

      const row = new ActionRowBuilder().addComponents(allAnswers.map((a, i) => new ButtonBuilder().setCustomId(`trivia_ans_${i}_${correctIdx}`).setLabel(`${letters[i]}: ${a.slice(0, 80)}`).setStyle(ButtonStyle.Primary)));
      const msg = await interaction.editReply({ embeds: [embed], components: [row] });

      const collector = msg.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 30000, max: 1 });
      collector.on('collect', async i => {
        const [,, chosen, correctI] = i.customId.split('_');
        const won = chosen === correctI;
        const newRow = new ActionRowBuilder().addComponents(allAnswers.map((a, idx) => new ButtonBuilder().setCustomId(`done_${idx}`).setLabel(`${letters[idx]}: ${a.slice(0, 80)}`).setStyle(idx === parseInt(correctI) ? ButtonStyle.Success : (idx === parseInt(chosen) && !won) ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(true)));
        await i.update({ embeds: [embed.setColor(won ? config.colors.success : config.colors.error).setFooter({ text: won ? '✅ Correct!' : `❌ Wrong! The answer was ${letters[correctIdx]}: ${correct}` })], components: [newRow] });
      });
      collector.on('end', async (_, reason) => { if (reason === 'time') await interaction.editReply({ components: [] }).catch(() => {}); });
    } catch { await interaction.editReply({ embeds: [Embed.error('Error', 'Could not fetch trivia. Try again!')] }); }
  },
};
