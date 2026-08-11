const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('transcript').setDescription('Save a transcript of this ticket'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const messages = await interaction.channel.messages.fetch({ limit: 200 });
    const content = [...messages.values()].reverse()
      .map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[Embed/Attachment]'}`).join('\n');
    const attachment = new AttachmentBuilder(Buffer.from(content), { name: `transcript-${interaction.channelId}.txt` });
    try {
      await interaction.user.send({ embeds: [Embed.info('Transcript', `Transcript for ${interaction.channel.name}`)], files: [attachment] });
      await interaction.editReply({ embeds: [Embed.success('Transcript Sent', 'Check your DMs for the transcript!')] });
    } catch {
      await interaction.editReply({ embeds: [Embed.warning('DM Failed', 'Could not DM transcript. Enable DMs from server members.')] });
    }
  },
};
