const { SlashCommandBuilder } = require('discord.js');
const Economy = require('../../utils/economy');
const Casino = require('../../utils/casino');

module.exports = {
  data: new SlashCommandBuilder().setName('slots').setDescription('Spin the slot machine for coins')
    .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager (default 25)').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(false)),
  async execute(interaction) {
    const wager = interaction.options.getInteger('wager') || 25;
    return Casino.playSlots(interaction, wager, false);
  },
};
