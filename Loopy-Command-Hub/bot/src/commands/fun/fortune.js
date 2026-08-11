const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const fortunes = ['A beautiful, smart, and loving person will be coming into your life.','A dubious friend may be an enemy in camouflage.','A faithful friend is a strong defense.','A feather in the hand is better than a bird in the air.','A fresh start will put you on your way.','A golden egg of opportunity falls into your lap this month.','A good friendship is often more important than a passionate romance.','A journey of a thousand miles begins with a single step.','A lifetime friend shall soon be made.','A light heart carries you through all the hard times.','All the answers you need are right there in front of you.','All things are difficult before they are easy.','An important person will offer you support.','Believe in yourself and others will too.','Better to have loved and lost than never to have loved at all.','Chance favors the prepared mind.','Change is happening in your life, so go with the flow!','Chase your passion, not your pension.','Courage is not the absence of fear; it is the mastery of it.','Creativity is intelligence having fun.','Dedicate yourself with a calm mind to the task at hand.','Determination is the wake-up call to the human will.','Disregard all previous cookies and ignore this one.','Do not fear what you do not know.','Dreams are the seeds of your future.'];
module.exports = {
  data: new SlashCommandBuilder().setName('fortune').setDescription('Get your fortune cookie message'),
  async execute(interaction) {
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    await interaction.reply({ embeds: [Embed.game('🥠 Fortune Cookie', `*"${fortune}"*`)] });
  },
};
