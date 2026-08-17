const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const Economy = require('../../utils/economy');
const config = require('../../config');

const SCOPE_CHOICES = [
  { name: 'This Server', value: 'server' },
  { name: 'Global (earned coins only)', value: 'global' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Currency, gambling, and leaderboard commands')
    .addSubcommand(s => s
      .setName('balance')
      .setDescription('View a member\'s wallet balance')
      .addUserOption(o => o.setName('user').setDescription('Member to check')))
    .addSubcommand(s => s.setName('daily').setDescription('Claim your daily coins'))
    .addSubcommand(s => s
      .setName('pay')
      .setDescription('Pay coins to another member')
      .addUserOption(o => o.setName('user').setDescription('Member to pay').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount to pay').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true)))
    .addSubcommand(s => s
      .setName('leaderboard')
      .setDescription('View the currency leaderboard')
      .addStringOption(o => o.setName('scope').setDescription('Server or Global ranking').addChoices(...SCOPE_CHOICES)))
    .addSubcommand(s => s
      .setName('give')
      .setDescription('(Admin) Give or take coins from a member — does not count toward global ranking')
      .addUserOption(o => o.setName('user').setDescription('Member to give coins to').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Coins to give (negative to remove)').setRequired(true)))
    .addSubcommand(s => s
      .setName('steal')
      .setDescription('Attempt to steal coins from another member')
      .addUserOption(o => o.setName('victim').setDescription('Member to target').setRequired(true)))
    .addSubcommand(s => s
      .setName('coinbet')
      .setDescription('Bet coins on heads or tails')
      .addStringOption(o => o.setName('side').setDescription('Your pick').setRequired(true).addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' }))
      .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true)))
    .addSubcommand(s => s
      .setName('dicebet')
      .setDescription('Bet coins on a high or low dice roll')
      .addStringOption(o => o.setName('guess').setDescription('High is 8–12; low is 2–6; 7 refunds').setRequired(true).addChoices({ name: 'High', value: 'high' }, { name: 'Low', value: 'low' }))
      .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true)))
    .addSubcommand(s => s
      .setName('blackjack')
      .setDescription('Play a quick automatic blackjack hand')
      .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true)))
    .addSubcommand(s => s
      .setName('roulette')
      .setDescription('Bet on an exact roulette number')
      .addIntegerOption(o => o.setName('number').setDescription('Pick 0–36').setMinValue(0).setMaxValue(36).setRequired(true))
      .addIntegerOption(o => o.setName('wager').setDescription('Coins to wager').setMinValue(1).setMaxValue(Economy.MAX_WAGER).setRequired(true))),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub     = interaction.options.getSubcommand();

    // ── Balance ───────────────────────────────────────────────────────────────
    if (sub === 'balance') {
      const user    = interaction.options.getUser('user') || interaction.user;
      const account = Economy.getBalance(guildId, user.id);
      const netWorth = account.wallet + account.bank;
      const walletPct = netWorth > 0 ? Math.round((account.wallet / netWorth) * 100) : 0;
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.gold,
          title: `💰 ${user.displayName}'s Balance`,
          description: [
            `> **Net Worth:** ${netWorth.toLocaleString()} coins`,
            `> \`${Embed.bar(account.wallet, netWorth > 0 ? netWorth : 1)}\` **${walletPct}%** in wallet`,
          ].join('\n'),
          thumbnail: user.displayAvatarURL({ dynamic: true }),
          fields: [
            Embed.field('👛 Wallet', `${account.wallet.toLocaleString()} coins`, true),
            Embed.field('🏦 Bank',   `${account.bank.toLocaleString()} coins`,   true),
            Embed.field('💎 Total',  `${netWorth.toLocaleString()} coins`, true),
            Embed.field('🔥 Daily Streak', `${account.daily_streak} day(s)`, true),
            Embed.field('📈 All-Time Won',  `${account.total_won.toLocaleString()} coins`,  true),
            Embed.field('📉 All-Time Lost', `${account.total_lost.toLocaleString()} coins`, true),
          ],
          footer: 'Economy',
        })],
      });
    }

    // ── Daily ─────────────────────────────────────────────────────────────────
    if (sub === 'daily') {
      const result = Economy.claimDaily(guildId, interaction.user.id);
      if (!result.claimed) {
        return interaction.reply({ embeds: [Embed.warning('Already Claimed', `⏳ Come back in **${Economy.formatTime(result.remaining)}** for your next reward.`)], ephemeral: true });
      }
      // Streak bonus caps at 7 days (250 base + streak*50). Show progress toward the max bonus.
      const cappedStreak = Math.min(result.streak, 7);
      const maxedOut = result.streak >= 7;
      const nextBonus = maxedOut ? 250 + 7 * 50 : 250 + Math.min(result.streak + 1, 7) * 50;
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.gold,
          title: '🎁 Daily Reward Claimed',
          description: [
            `You received **${result.amount.toLocaleString()}** coins! 💰`,
            '',
            `> 🔥 **Streak:** ${result.streak} day${result.streak === 1 ? '' : 's'}`,
            `> \`${Embed.bar(cappedStreak, 7)}\` ${maxedOut ? 'Max bonus reached!' : `${7 - cappedStreak} day(s) to max bonus`}`,
            '',
            maxedOut
              ? `💎 You're earning the **maximum** daily bonus. Keep it going!`
              : `⏭️ Claim again tomorrow for **${nextBonus.toLocaleString()}** coins.`,
          ].join('\n'),
          thumbnail: interaction.user.displayAvatarURL({ dynamic: true }),
          footer: 'Come back every day to keep your streak alive',
        })],
      });
    }

    // ── Pay ───────────────────────────────────────────────────────────────────
    if (sub === 'pay') {
      const user   = interaction.options.getUser('user');
      const result = Economy.transfer(guildId, interaction.user.id, user.id, interaction.options.getInteger('amount'));
      if (!result) {
        return interaction.reply({ embeds: [Embed.error('Payment Failed', 'Check your balance, the amount, and ensure you are not paying yourself.')], ephemeral: true });
      }
      return interaction.reply({
        embeds: [Embed.success('Payment Sent', `${interaction.user} paid **${result.amount.toLocaleString()}** coins to ${user}.`)],
      });
    }

    // ── Admin Give ────────────────────────────────────────────────────────────
    if (sub === 'give') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ embeds: [Embed.error('Permission Denied', 'You need Manage Server to use this command.')], ephemeral: true });
      }
      const user   = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');
      if (user.id === interaction.user.id) {
        return interaction.reply({ embeds: [Embed.error('Not Allowed', 'You cannot give coins to yourself.')], ephemeral: true });
      }
      const result = Economy.adminGive(guildId, user.id, amount);
      if (!result) {
        return interaction.reply({ embeds: [Embed.error('Failed', 'Invalid amount.')], ephemeral: true });
      }
      const action = amount >= 0 ? `gave **+${amount.toLocaleString()}**` : `removed **${Math.abs(amount).toLocaleString()}**`;
      return interaction.reply({
        embeds: [Embed.success(
          'Balance Updated',
          `${interaction.user} ${action} coins ${amount >= 0 ? 'to' : 'from'} ${user}.\nNew wallet: **${result.wallet.toLocaleString()}** coins.\n\n> Admin-given coins do not count toward the global leaderboard.`,
        )],
        ephemeral: true,
      });
    }

    // ── Leaderboard ───────────────────────────────────────────────────────────
    if (sub === 'leaderboard') {
      const scope  = interaction.options.getString('scope') ?? 'server';
      const global = scope === 'global';

      await interaction.deferReply();
      const rows = global ? Economy.globalLeaderboard() : Economy.leaderboard(guildId);

      if (!rows.length) {
        return interaction.editReply({ embeds: [Embed.info('Currency Leaderboard', 'No data yet. Use `/economy daily` to get started.')] });
      }

      const lines = rows.map((row, i) => {
        const pos    = i < 3 ? ['🥇', '🥈', '🥉'][i] : `**${i + 1}.**`;
        const amount = global
          ? `**${row.earned.toLocaleString()}** earned`
          : `**${row.total.toLocaleString()}** coins`;
        const server = global && row.server_count > 1 ? ` · ${row.server_count} servers` : '';
        return `${pos} <@${row.user_id}> — ${amount}${server}`;
      });

      return interaction.editReply({
        embeds: [Embed.base({
          color:       config.colors.gold,
          title:       global ? '🏆 Currency Leaderboard — Global' : '🏆 Currency Leaderboard — This Server',
          description: lines.join('\n'),
          footer:      global
            ? 'Global · Ranked by coins earned through gameplay (admin gifts excluded)'
            : 'Server · Use /economy leaderboard scope:Global for worldwide ranking',
        })],
      });
    }

    // ── Steal ─────────────────────────────────────────────────────────────────
    if (sub === 'steal') {
      const victim   = interaction.options.getUser('victim');
      if (victim.bot || victim.id === interaction.user.id) {
        return interaction.reply({ embeds: [Embed.error('Invalid Target', 'Choose another human member.')], ephemeral: true });
      }
      const cooldown = Economy.canSteal(guildId, interaction.user.id);
      if (!cooldown.allowed) {
        return interaction.reply({ embeds: [Embed.warning('Cooldown', `Next attempt ready in **${Economy.formatTime(cooldown.remaining)}**.`)], ephemeral: true });
      }
      Economy.markSteal(guildId, interaction.user.id);
      if (Math.random() > 0.45) {
        return interaction.reply({ embeds: [Embed.error('Caught', `The guards caught ${interaction.user} attempting to steal from ${victim}.`)] });
      }
      const amount = Economy.steal(guildId, interaction.user.id, victim.id);
      if (!amount) return interaction.reply({ embeds: [Embed.warning('Empty Pockets', `${victim} has no wallet coins to steal.`)] });
      return interaction.reply({ embeds: [Embed.success('Successful Heist', `${interaction.user} stole **${amount.toLocaleString()}** coins from ${victim}.`)] });
    }

    // ── Gambling commands ─────────────────────────────────────────────────────
    const wager = interaction.options.getInteger('wager');
    if (Economy.getBalance(guildId, interaction.user.id).wallet < wager) {
      return interaction.reply({ embeds: [Embed.error('Insufficient Funds', 'Your wallet cannot cover that wager.')], ephemeral: true });
    }

    if (sub === 'coinbet') {
      const side   = interaction.options.getString('side');
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won    = side === result;
      Economy.changeWallet(guildId, interaction.user.id, won ? wager : -wager);
      return interaction.reply({
        embeds: [Embed.base({
          color:       won ? config.colors.success : config.colors.error,
          title:       'Coin Bet',
          description: `The coin landed on **${result}**.\n${won ? `You won **${wager.toLocaleString()}** coins.` : `You lost **${wager.toLocaleString()}** coins.`}`,
          footer:      'Economy',
        })],
      });
    }

    if (sub === 'blackjack') {
      const cardValue   = () => Math.floor(Math.random() * 10) + 2;
      const player      = [cardValue(), cardValue()];
      const dealer      = [cardValue(), cardValue()];
      const playerTotal = player.reduce((s, c) => s + c, 0);
      const dealerTotal = dealer.reduce((s, c) => s + c, 0);
      const won  = playerTotal > dealerTotal && playerTotal <= 21;
      const push = playerTotal === dealerTotal || (playerTotal > 21 && dealerTotal > 21);
      const delta = push ? 0 : won ? wager : -wager;
      Economy.changeWallet(guildId, interaction.user.id, delta);
      return interaction.reply({
        embeds: [Embed.base({
          color:       push ? config.colors.info : won ? config.colors.success : config.colors.error,
          title:       'Blackjack',
          description: `Your hand: ${player.join(' + ')} = **${playerTotal}**\nDealer hand: ${dealer.join(' + ')} = **${dealerTotal}**\n\n${push ? 'Push — wager returned.' : won ? `You won **${wager.toLocaleString()}** coins.` : `You lost **${wager.toLocaleString()}** coins.`}`,
          footer:      'Economy',
        })],
      });
    }

    if (sub === 'roulette') {
      const pick   = interaction.options.getInteger('number');
      const result = Math.floor(Math.random() * 37);
      const won    = pick === result;
      Economy.changeWallet(guildId, interaction.user.id, won ? wager * 35 : -wager);
      return interaction.reply({
        embeds: [Embed.base({
          color:       won ? config.colors.success : config.colors.error,
          title:       'Roulette',
          description: `You picked **${pick}**, wheel landed on **${result}**.\n${won ? `Exact hit — you won **${(wager * 35).toLocaleString()}** coins!` : `You lost **${wager.toLocaleString()}** coins.`}`,
          footer:      'Economy',
        })],
      });
    }

    // dicebet
    const guess = interaction.options.getString('guess');
    const roll  = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;
    const won   = (guess === 'high' && roll >= 8) || (guess === 'low' && roll <= 6);
    const delta = roll === 7 ? 0 : won ? wager : -wager;
    Economy.changeWallet(guildId, interaction.user.id, delta);
    return interaction.reply({
      embeds: [Embed.base({
        color:       roll === 7 ? config.colors.info : won ? config.colors.success : config.colors.error,
        title:       'Dice Bet',
        description: `You rolled **${roll}**.\n${roll === 7 ? 'Seven — wager returned.' : won ? `You won **${wager.toLocaleString()}** coins.` : `You lost **${wager.toLocaleString()}** coins.`}`,
        footer:      'Economy',
      })],
    });
  },
};
