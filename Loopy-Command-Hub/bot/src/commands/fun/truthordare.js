const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('truthordare')
    .setDescription('Get a Truth or Dare prompt!')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Truth, Dare, or Random?')
        .setRequired(true)
        .addChoices(
          { name: 'Truth', value: 'truth' },
          { name: 'Dare', value: 'dare' },
          { name: 'Random', value: 'random' },
        )),

  async execute(interaction) {
    await interaction.deferReply();

    let type = interaction.options.getString('type');
    if (type === 'random') type = Math.random() < 0.5 ? 'truth' : 'dare';

    const prompt = type === 'truth'
      ? `Generate a fun, interesting truth question for a Discord server game. It should be entertaining but completely safe for work — no personal, offensive, or inappropriate content. Keep it to one sentence.`
      : `Generate a fun, creative dare for a Discord server game. It should be entertaining, harmless, and doable online — no physical, offensive, or inappropriate content. Keep it to one sentence.`;

    const aiResponse = await AI.ask(prompt, null, 150);
    const content = aiResponse || (type === 'truth' ? 'What is your most embarrassing hobby?' : 'Send a compliment to the next person who messages in chat.');

    const emoji = type === 'truth' ? '💬' : '🎯';
    const label = type === 'truth' ? 'Truth' : 'Dare';
    const color = type === 'truth' ? 0x5865F2 : 0xED4245;

    const embed = Embed.game(`${emoji} ${label}!`, content, [], color);

    await interaction.editReply({ embeds: [embed] });
  },
};
