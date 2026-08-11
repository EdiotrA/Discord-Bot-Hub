const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('poll').setDescription('Create a poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
    .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false))
    .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false))
    .addStringOption(o => o.setName('option5').setDescription('Option 5').setRequired(false))
    .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes (default 60)').setRequired(false).setMinValue(1).setMaxValue(1440)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const opts = ['option1','option2','option3','option4','option5'].map(k => interaction.options.getString(k)).filter(Boolean);
    const nums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'];
    const dur = (interaction.options.getInteger('duration') || 60) * 60 * 1000;
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle(`📊 ${question}`)
      .setDescription(opts.map((o, i) => `${nums[i]} ${o}`).join('\n'))
      .setFooter({ text: `Poll by ${interaction.user.tag} • Ends in ${dur/60000} minutes` }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    const msg = await interaction.fetchReply();
    for (let i = 0; i < opts.length; i++) await msg.react(nums[i]);
    setTimeout(async () => {
      const refreshed = await msg.fetch();
      const results = opts.map((o, i) => `${nums[i]} ${o} — **${(refreshed.reactions.cache.get(nums[i])?.count || 1) - 1} votes**`).join('\n');
      const finalEmbed = new EmbedBuilder().setColor(config.colors.gold).setTitle(`📊 Poll Ended — ${question}`).setDescription(results).setTimestamp();
      await msg.reply({ embeds: [finalEmbed] });
    }, dur);
  },
};
