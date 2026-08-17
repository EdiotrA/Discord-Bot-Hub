const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');
module.exports = {
  data: new SlashCommandBuilder().setName('roast').setDescription('Get a friendly roast for a user')
    .addUserOption(o => o.setName('user').setDescription('User to roast').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user');
    const roast = await AI.generateRoast(target.username);
    const embed = Embed.base({
      color: config.colors.error,
      title: '🔥 Roasted!',
      description: `${target}\n\n> *${roast || 'You\'re so average, even the average is better than you!'}*`,
      thumbnail: target.displayAvatarURL({ dynamic: true }),
      footer: 'All in good fun — no hard feelings!',
    });
    await interaction.editReply({ embeds: [embed] });
  },
};
