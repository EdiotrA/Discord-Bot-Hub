const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Economy = require('../../utils/economy');
const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '🎰', '🎯'];
module.exports = {
  data: new SlashCommandBuilder().setName('slots').setDescription('Spin the slot machine for coins')
    .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager (default 25)').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(false)),
  async execute(interaction) {
    const wager = interaction.options.getInteger('wager') || 25;
    const account = Economy.getBalance(interaction.guildId, interaction.user.id);
    if (account.wallet < wager) return interaction.reply({ embeds: [Embed.error('Not Enough Coins', `You need **${wager.toLocaleString()}** coins but only have **${account.wallet.toLocaleString()}**.`)], ephemeral: true });
    const s = () => symbols[Math.floor(Math.random() * symbols.length)];
    const [a, b, c] = [s(), s(), s()];
    let payout = 0, result, color;
    if (a === b && b === c) { payout = wager * (a === '💎' || a === '🎰' ? 12 : 8); result = `🎉 **JACKPOT!** You won **${payout.toLocaleString()}** coins!`; color = 0xF1C40F; }
    else if (a === b || b === c || a === c) { payout = wager * 2; result = `✨ **Small Win!** You won **${payout.toLocaleString()}** coins!`; color = 0x57F287; }
    else { result = `😢 No match. You lost **${wager.toLocaleString()}** coins.`; color = 0xED4245; }
    Economy.changeWallet(interaction.guildId, interaction.user.id, payout - wager);
    await interaction.reply({ embeds: [Embed.game('🎰 Slot Machine', `┌─────────────┐\n│  ${a}  ${b}  ${c}  │\n└─────────────┘\n\n${result}\n\n**Balance:** ${Economy.getBalance(interaction.guildId, interaction.user.id).wallet.toLocaleString()} coins`, [], color)] });
  },
};
