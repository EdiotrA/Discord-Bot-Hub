const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const Embed = require('../../utils/embed');
const Economy = require('../../utils/economy');
const Casino = require('../../utils/casino');

// ─── Arcade dashboard ───────────────────────────────────────────────────────

function arcadeEmbed(interaction) {
  const account = Economy.getBalance(interaction.guildId, interaction.user.id);
  return Embed.base({
    color: config.colors.game,
    title: '🕹️ Loopy Arcade',
    description: [
      `Welcome to the arcade, **${interaction.user.displayName}**!`,
      '',
      '**🎰 Casino** — bet your coins',
      '> 🂡 Blackjack · 🎡 Roulette · 🎰 Slots · 🪙 Coinflip · 🎲 Dice Duel',
      '',
      '**🎮 Classics** — free to play',
      '> `/trivia` `/tictactoe` `/rps` `/numberguess` `/8ball`',
      '',
      '**🎉 Social**',
      '> `/wouldyourather` `/poll` `/giveaway` `/roast` `/compliment`',
    ].join('\n'),
    fields: [
      Embed.field('💰 Wallet', `${account.wallet.toLocaleString()} coins`, true),
      Embed.field('🏦 Bank', `${account.bank.toLocaleString()} coins`, true),
      Embed.field('🔥 Daily Streak', `${account.daily_streak} day(s)`, true),
    ],
    thumbnail: interaction.guild?.iconURL({ dynamic: true }) || undefined,
    footer: 'Pick a casino game below — then choose your bet',
  });
}

function arcadeRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`arcade:pick_bj:0:${userId}`).setLabel('Blackjack').setEmoji('🂡').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`arcade:pick_rl:0:${userId}`).setLabel('Roulette').setEmoji('🎡').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`arcade:pick_slots:0:${userId}`).setLabel('Slots').setEmoji('🎰').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`arcade:pick_cf:0:${userId}`).setLabel('Coinflip').setEmoji('🪙').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`arcade:pick_dd:0:${userId}`).setLabel('Dice Duel').setEmoji('🎲').setStyle(ButtonStyle.Secondary),
  );
}

const GAME_NAMES = { bj: '🂡 Blackjack', rl: '🎡 Roulette', slots: '🎰 Slots', cf: '🪙 Coinflip', dd: '🎲 Dice Duel' };

module.exports = {
  data: new SlashCommandBuilder().setName('games').setDescription('List all available games and fun commands'),

  async execute(interaction) {
    await interaction.reply({ embeds: [arcadeEmbed(interaction)], components: [arcadeRow(interaction.user.id)] });
  },

  /** Routes all `arcade:*` buttons. customId = arcade:<action>:<wager>:<ownerId> */
  async handleArcadeButton(interaction) {
    const [, action, wagerStr, ownerId] = interaction.customId.split(':');

    // Anyone may open their own arcade from a shared message — but game
    // launches tied to a wager stay with the owner.
    if (action === 'menu') {
      return interaction.reply({
        embeds: [arcadeEmbed(interaction)],
        components: [arcadeRow(interaction.user.id)],
        ephemeral: true,
      });
    }

    if (interaction.user.id !== ownerId) {
      return interaction.reply({
        embeds: [Embed.error('Not Your Session', 'Run `/games` to open your own arcade!')],
        ephemeral: true,
      });
    }

    // Step 1: game picked → show wager selector
    if (action.startsWith('pick_')) {
      const game = action.slice(5);
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.game,
          title: GAME_NAMES[game] ?? 'Casino',
          description: 'How much do you want to bet?',
          footer: `Wallet: ${Economy.getBalance(interaction.guildId, interaction.user.id).wallet.toLocaleString()} coins`,
        })],
        components: [Casino.wagerRow(game, interaction.user.id)],
        ephemeral: true,
      });
    }

    // Step 2: wager picked → launch game
    const wager = Number(wagerStr);
    if (!Number.isFinite(wager) || wager <= 0) {
      return interaction.reply({ embeds: [Embed.error('Bad Wager', 'Something went wrong — try again from `/games`.')], ephemeral: true });
    }

    switch (action) {
      case 'bj': return Casino.startBlackjack(interaction, wager);
      case 'rl': return Casino.startRoulette(interaction, wager);
      case 'cf': return Casino.startCoinflipBet(interaction, wager);
      case 'dd': return Casino.startDiceDuel(interaction, wager);
      case 'slots': return Casino.playSlots(interaction, wager, true);
      default:
        return interaction.reply({ embeds: [Embed.error('Unknown Game', 'Try again from `/games`.')], ephemeral: true });
    }
  },

  // Legacy handler kept for old messages still carrying game_ttt/game_c4/game_rps buttons
  handleGameButton: async (interaction) => {
    await interaction.reply({ content: 'This button is from an older version — run `/games` for the new arcade!', ephemeral: true });
  },
};
