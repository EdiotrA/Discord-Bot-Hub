const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Economy = require('../../utils/economy');

module.exports = {
  data: new SlashCommandBuilder().setName('economy').setDescription('Currency, gambling, and heist commands')
    .addSubcommand(s => s.setName('balance').setDescription('View a member wallet balance')
      .addUserOption(o => o.setName('user').setDescription('Member to check').setRequired(false)))
    .addSubcommand(s => s.setName('daily').setDescription('Claim your daily coins'))
    .addSubcommand(s => s.setName('pay').setDescription('Pay coins to another member')
      .addUserOption(o => o.setName('user').setDescription('Member to pay').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to pay').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the server currency leaderboard'))
    .addSubcommand(s => s.setName('steal').setDescription('Try to steal coins from another member')
      .addUserOption(o => o.setName('victim').setDescription('Member to target').setRequired(true)))
    .addSubcommand(s => s.setName('coinbet').setDescription('Bet coins on heads or tails')
      .addStringOption(o => o.setName('side').setDescription('Your pick').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' }))
      .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true)))
    .addSubcommand(s => s.setName('dicebet').setDescription('Bet coins on a high or low dice roll')
      .addStringOption(o => o.setName('guess').setDescription('High is 8-12; low is 2-6; 7 refunds').setRequired(true).addChoices({ name: 'High', value: 'high' }, { name: 'Low', value: 'low' }))
      .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true))),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === 'balance') {
      const user = interaction.options.getUser('user') || interaction.user;
      const account = Economy.getBalance(guildId, user.id);
      return interaction.reply({ embeds: [Embed.game('🪙 Wallet', `${user} has **${account.wallet.toLocaleString()}** coins in their wallet and **${account.bank.toLocaleString()}** in the bank.`, [
        { name: 'Total', value: `${(account.wallet + account.bank).toLocaleString()} coins`, inline: true },
        { name: 'Daily streak', value: `${account.daily_streak} day(s)`, inline: true },
      ])] });
    }

    if (sub === 'daily') {
      const result = Economy.claimDaily(guildId, interaction.user.id);
      if (!result.claimed) return interaction.reply({ embeds: [Embed.warning('Already Claimed', `Come back in **${Economy.formatTime(result.remaining)}**.`)], ephemeral: true });
      return interaction.reply({ embeds: [Embed.success('Daily Claimed', `You received **${result.amount.toLocaleString()}** coins.\n🔥 Streak: **${result.streak}** day(s).`)] });
    }

    if (sub === 'pay') {
      const user = interaction.options.getUser('user');
      const result = Economy.transfer(guildId, interaction.user.id, user.id, interaction.options.getInteger('amount'));
      if (!result) return interaction.reply({ embeds: [Embed.error('Payment Failed', 'Check the amount, your balance, and make sure you are not paying yourself.')], ephemeral: true });
      return interaction.reply({ embeds: [Embed.success('Payment Sent', `${interaction.user} paid **${result.amount.toLocaleString()}** coins to ${user}.`)] });
    }

    if (sub === 'leaderboard') {
      const rows = Economy.leaderboard(guildId);
      if (!rows.length) return interaction.reply({ embeds: [Embed.info('Currency Leaderboard', 'Nobody has a wallet yet. Use `/economy daily` to get started.')] });
      const lines = rows.map((row, i) => `${['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`} <@${row.user_id}> — **${row.total.toLocaleString()}** coins`);
      return interaction.reply({ embeds: [Embed.leaderboard('Currency Leaderboard', lines.join('\n'), [])] });
    }

    if (sub === 'steal') {
      const victim = interaction.options.getUser('victim');
      if (victim.bot || victim.id === interaction.user.id) return interaction.reply({ embeds: [Embed.error('Invalid Target', 'Choose another human member.')], ephemeral: true });
      const cooldown = Economy.canSteal(guildId, interaction.user.id);
      if (!cooldown.allowed) return interaction.reply({ embeds: [Embed.warning('Steal Cooldown', `Your next attempt is ready in **${Economy.formatTime(cooldown.remaining)}**.`)], ephemeral: true });
      Economy.markSteal(guildId, interaction.user.id);
      if (Math.random() > 0.45) return interaction.reply({ embeds: [Embed.error('Caught!', `The guards caught ${interaction.user} trying to steal from ${victim}.`)] });
      const amount = Economy.steal(guildId, interaction.user.id, victim.id);
      if (!amount) return interaction.reply({ embeds: [Embed.warning('Empty Pockets', `${victim} does not have any wallet coins to steal.`)] });
      return interaction.reply({ embeds: [Embed.success('Successful Heist', `${interaction.user} stole **${amount.toLocaleString()}** coins from ${victim}!`)] });
    }

    const wager = interaction.options.getInteger('wager');
    if (Economy.getBalance(guildId, interaction.user.id).wallet < wager) {
      return interaction.reply({ embeds: [Embed.error('Not Enough Coins', 'Your wallet cannot cover that wager.')], ephemeral: true });
    }

    if (sub === 'coinbet') {
      const side = interaction.options.getString('side');
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = side === result;
      Economy.changeWallet(guildId, interaction.user.id, won ? wager : -wager);
      return interaction.reply({ embeds: [Embed.game('🪙 Coin Bet', `The coin landed on **${result}**.\n${won ? `🎉 You won **${wager.toLocaleString()}** coins!` : `😢 You lost **${wager.toLocaleString()}** coins.`}`)] });
    }

    const guess = interaction.options.getString('guess');
    const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;
    const won = (guess === 'high' && roll >= 8) || (guess === 'low' && roll <= 6);
    const delta = roll === 7 ? 0 : won ? wager : -wager;
    Economy.changeWallet(guildId, interaction.user.id, delta);
    return interaction.reply({ embeds: [Embed.game('🎲 Dice Bet', `You rolled **${roll}**.\n${roll === 7 ? '🤝 Seven is a push — your wager was returned.' : won ? `🎉 You won **${wager.toLocaleString()}** coins!` : `😢 You lost **${wager.toLocaleString()}** coins.`}`)] });
  },
};