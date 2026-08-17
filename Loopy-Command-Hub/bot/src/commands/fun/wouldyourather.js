const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');
module.exports = {
  data: new SlashCommandBuilder().setName('wouldyourather').setDescription('Get a Would You Rather question'),
  async execute(interaction) {
    await interaction.deferReply();
    const result = await AI.ask('Generate a fun "Would You Rather" question with exactly two options labeled A and B. Format: "Would you rather...\n\nA) option1\nB) option2". Keep it appropriate for all ages. Only respond with the question, nothing else.', null, 200);
    const text = result || 'Would you rather have the ability to fly or be invisible?\n\nA) Fly\nB) Be Invisible';
    const embed = Embed.base({
      color: config.colors.purple,
      title: '🤔 Would You Rather...',
      description: `> ${text.replace(/\n/g, '\n> ')}`,
      footer: 'A tough choice awaits',
    });
    embed.addFields({ name: '🗳️ Cast Your Vote', value: 'React with 🅰️ or 🅱️ below!' });
    await interaction.editReply({ embeds: [embed] });
    const msg = await interaction.fetchReply();
    await msg.react('🅰️'); await msg.react('🅱️');
  },
};
