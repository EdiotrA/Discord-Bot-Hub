const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');
module.exports = {
  data: new SlashCommandBuilder().setName('roast').setDescription('Get a friendly roast for a user')
    .addUserOption(o => o.setName('user').setDescription('User to roast').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');
    const roast = await AI.generateRoast(target.username);
    await interaction.editReply({ embeds: [Embed.game('🔥 Roast', `${target} — ${roast || 'You\'re so average, even the average is better than you!'}`)] });
  },
};
