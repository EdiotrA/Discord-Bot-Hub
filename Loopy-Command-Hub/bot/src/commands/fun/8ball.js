const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const answers = ['It is certain.','It is decidedly so.','Without a doubt.','Yes, definitely.','You may rely on it.','As I see it, yes.','Most likely.','Outlook good.','Yes.','Signs point to yes.','Reply hazy, try again.','Ask again later.','Better not tell you now.','Cannot predict now.','Concentrate and ask again.','Don\'t count on it.','My reply is no.','My sources say no.','Outlook not so good.','Very doubtful.'];
module.exports = {
  data: new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question')
    .addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)),
  async execute(interaction) {
    const q = interaction.options.getString('question');
    const answer = answers[Math.floor(Math.random() * answers.length)];
    const positive = answers.indexOf(answer) < 10; const neutral = answers.indexOf(answer) < 15;
    const color = positive ? config.colors.success : neutral ? config.colors.warning : config.colors.error;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(color).setTitle('🎱 Magic 8-Ball').addFields({ name: '❓ Question', value: q }, { name: '🎱 Answer', value: answer }).setTimestamp()] });
  },
};
