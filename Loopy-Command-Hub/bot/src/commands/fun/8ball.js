const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const answers = ['It is certain.','It is decidedly so.','Without a doubt.','Yes, definitely.','You may rely on it.','As I see it, yes.','Most likely.','Outlook good.','Yes.','Signs point to yes.','Reply hazy, try again.','Ask again later.','Better not tell you now.','Cannot predict now.','Concentrate and ask again.','Don\'t count on it.','My reply is no.','My sources say no.','Outlook not so good.','Very doubtful.'];
module.exports = {
  data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const q = interaction.options.getString('question');
    const answer = answers[Math.floor(Math.random() * answers.length)];
    const positive = answers.indexOf(answer) < 10; const neutral = answers.indexOf(answer) < 15;
    const color = positive ? config.colors.success : neutral ? config.colors.warning : config.colors.error;
    const embed = Embed.base({
      color,
      emoji: '🎱',
      title: 'Magic 8-Ball',
      description: `> **Question**\n> ${q}\n\n> **Answer**\n> ${answer}`,
      thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
      footer: 'The 8-Ball has spoken',
    });
    await interaction.reply({ embeds: [embed] });
  },
};
