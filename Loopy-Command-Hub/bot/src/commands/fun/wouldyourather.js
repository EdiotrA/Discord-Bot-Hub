const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');
module.exports = {
  data: new SlashCommandBuilder().setName('wouldyourather').setDescription('Get a Would You Rather question'),
  async execute(interaction) {
    await interaction.deferReply();
    const result = await AI.ask('Generate a fun "Would You Rather" question with exactly two options labeled A and B. Format: "Would you rather...\n\nA) option1\nB) option2". Keep it appropriate for all ages. Only respond with the question, nothing else.', null, 200);
    const embed = Embed.game('🤔 Would You Rather', result || 'Would you rather have the ability to fly or be invisible?\n\nA) Fly\nB) Be Invisible');
    embed.addFields({ name: 'Vote!', value: 'React with 🅰️ or 🅱️ to vote!' });
    await interaction.editReply({ embeds: [embed] });
    const msg = await interaction.fetchReply();
    await msg.react('🅰️'); await msg.react('🅱️');
  },
};
