const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const Embed = require('../../utils/embed');
const AI = require('../../utils/ai');

function buildAssistantModal() {
  return new ModalBuilder()
    .setCustomId('assistant_modal')
    .setTitle('Ask Loopy')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('assistant_prompt')
        .setLabel('What do you need help with?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2_000)
        .setPlaceholder('Ask about coding, UI ideas, debugging, or the server...'),
    ));
}

async function handleAssistantModal(interaction) {
  await interaction.deferReply({ ephemeral: false });
  const prompt = interaction.fields.getTextInputValue('assistant_prompt');
  const response = await AI.answerAssistant(prompt);
  if (!response) {
    return interaction.editReply({
      embeds: [Embed.error('AI Unavailable', 'The AI helper is not configured or is temporarily unavailable.')],
    });
  }
  return interaction.editReply({ embeds: [Embed.info('Loopy Assistant', response.replace(/@everyone|@here/g, '@ staff'))] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assistant')
    .setDescription('Ask Loopy for coding, UI, debugging, or server help')
    .addStringOption(o => o
      .setName('prompt')
      .setDescription('What you need help with')
      .setRequired(true)
      .setMaxLength(2_000)),
  async execute(interaction) {
    await interaction.deferReply();
    const response = await AI.answerAssistant(interaction.options.getString('prompt'));
    if (!response) {
      return interaction.editReply({
        embeds: [Embed.error('AI Unavailable', 'The AI helper is not configured or is temporarily unavailable.')],
      });
    }
    return interaction.editReply({ embeds: [Embed.info('Loopy Assistant', response.replace(/@everyone|@here/g, '@ staff'))] });
  },
  buildAssistantModal,
  handleAssistantModal,
};