const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');
module.exports = {
  data: new SlashCommandBuilder().setName('compliment').setDescription('Give someone a genuine compliment')
    .addUserOption(o => o.setName('user').setDescription('User to compliment').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');
    const compliment = await AI.generateCompliment(target.username);
    await interaction.editReply({ embeds: [Embed.success('💝 Compliment', `${target} — ${compliment || 'You are an amazing person who brings joy to everyone around you!'}`)] });
  },
};
