/**
 * ─────────────────────────────────────────────────────────────
 *  Loopy Casino Engine — button-driven games (no new slash cmds)
 *  Blackjack (stateful), Roulette (instant), Coinflip & Dice bets.
 *  All games use the shared Economy wallet.
 * ─────────────────────────────────────────────────────────────
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Embed = require('./embed');
const Economy = require('./economy');
const config = require('../config');

const WAGERS = [25, 100, 250, 1000];

// ─── Shared helpers ─────────────────────────────────────────────────────────

const fmt = (n) => n.toLocaleString();

function walletOf(guildId, userId) {
  return Economy.getBalance(guildId, userId).wallet;
}

/** Standard "not enough coins" ephemeral reply. */
async function insufficient(interaction, wager) {
  const wallet = walletOf(interaction.guildId, interaction.user.id);
  return interaction.reply({
    embeds: [Embed.error('Not Enough Coins', `That bet is **${fmt(wager)}** coins — you have **${fmt(wallet)}**.\nEarn more with \`/economy daily\` or \`/economy work\`.`)],
    ephemeral: true,
  });
}

/** Wager picker row for a given game key. */
function wagerRow(game, userId) {
  return new ActionRowBuilder().addComponents(
    ...WAGERS.map(w =>
      new ButtonBuilder()
        .setCustomId(`arcade:${game}:${w}:${userId}`)
        .setLabel(`${fmt(w)}`)
        .setEmoji('🪙')
        .setStyle(w >= 1000 ? ButtonStyle.Danger : w >= 250 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );
}

// ─── Blackjack ──────────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const bjGames = new Map(); // `${guildId}:${userId}` → { sid, deck, player, dealer, wager, timer }
const BJ_TIMEOUT_MS = 5 * 60 * 1000; // abandon → refund after 5 minutes

const newSid = () => Math.random().toString(36).slice(2, 8);

function newDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ r, s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.r === 'A') { aces++; total += 11; }
    else if (['J', 'Q', 'K'].includes(c.r)) total += 10;
    else total += Number(c.r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

const cardStr = (c) => `\`${c.r}${c.s}\``;
const handStr = (hand) => hand.map(cardStr).join(' ');

function bjButtons(userId, sid, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj:hit:${userId}:${sid}`).setLabel('Hit').setEmoji('🃏').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`bj:stand:${userId}:${sid}`).setLabel('Stand').setEmoji('✋').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`bj:double:${userId}:${sid}`).setLabel('Double Down').setEmoji('⚡').setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );
}

function bjEmbed(game, { hideDealer = true, status = null, color = config.colors.game } = {}) {
  const pv = handValue(game.player);
  const dealerShown = hideDealer ? [game.dealer[0]] : game.dealer;
  const dv = handValue(dealerShown);
  return Embed.base({
    color,
    title: '🂡 Blackjack',
    description: status ? `${status}` : `Bet: **${fmt(game.wager)}** coins — Hit, Stand, or Double Down?`,
    fields: [
      Embed.field(`Your Hand — ${pv}`, handStr(game.player), true),
      Embed.field(`Dealer — ${hideDealer ? `${dv} + ?` : dv}`, hideDealer ? `${cardStr(game.dealer[0])} \`🂠\`` : handStr(game.dealer), true),
    ],
    footer: 'Blackjack pays 2.5x · Win pays 2x · Push refunds',
  });
}

async function startBlackjack(interaction, wager) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  if (bjGames.has(key)) {
    return interaction.reply({ embeds: [Embed.warning('Game In Progress', 'Finish your current blackjack hand first!')], ephemeral: true });
  }
  if (walletOf(interaction.guildId, interaction.user.id) < wager) return insufficient(interaction, wager);

  Economy.changeWallet(interaction.guildId, interaction.user.id, -wager);
  const deck = newDeck();
  const game = { sid: newSid(), deck, player: [deck.pop(), deck.pop()], dealer: [deck.pop(), deck.pop()], wager };
  bjGames.set(key, game);

  // Natural blackjack check (settle handles dealer-natural push)
  if (handValue(game.player) === 21) return settleBlackjack(interaction, key, game, true);

  armBjTimeout(interaction, key, game);
  return interaction.reply({ embeds: [bjEmbed(game)], components: [bjButtons(interaction.user.id, game.sid)] });
}

/** Abandoned hand → refund the stake and free the seat. */
function armBjTimeout(interaction, key, game) {
  if (game.timer) clearTimeout(game.timer);
  game.timer = setTimeout(() => {
    const current = bjGames.get(key);
    if (!current || current.sid !== game.sid) return; // already settled / new game
    bjGames.delete(key);
    Economy.changeWallet(interaction.guildId, interaction.user.id, current.wager); // refund
  }, BJ_TIMEOUT_MS);
  if (game.timer.unref) game.timer.unref();
}

async function settleBlackjack(interaction, key, game, isNew = false) {
  if (game.timer) clearTimeout(game.timer);
  const pv = handValue(game.player);
  const playerNatural = pv === 21 && game.player.length === 2;
  const dealerNatural = handValue(game.dealer) === 21 && game.dealer.length === 2;
  // Dealer draws to 17 (skip if either has a natural — hand is decided)
  if (!playerNatural && !dealerNatural) {
    while (handValue(game.dealer) < 17) game.dealer.push(game.deck.pop());
  }
  const dv = handValue(game.dealer);

  let payout = 0, status, color;
  if (pv > 21) { status = `💥 **Bust!** You lost **${fmt(game.wager)}** coins.`; color = config.colors.error; }
  else if (playerNatural && dealerNatural) { payout = game.wager; status = `🤝 **Both blackjack — push.** Your **${fmt(game.wager)}** coins were refunded.`; color = config.colors.warning; }
  else if (dealerNatural) { status = `🎴 **Dealer blackjack.** You lost **${fmt(game.wager)}** coins.`; color = config.colors.error; }
  else if (playerNatural) { payout = Math.floor(game.wager * 2.5); status = `🎴 **BLACKJACK!** You won **${fmt(payout)}** coins!`; color = config.colors.gold; }
  else if (dv > 21) { payout = game.wager * 2; status = `🎉 **Dealer busts!** You won **${fmt(payout)}** coins!`; color = config.colors.success; }
  else if (pv > dv) { payout = game.wager * 2; status = `🎉 **You win!** **${fmt(payout)}** coins!`; color = config.colors.success; }
  else if (pv === dv) { payout = game.wager; status = `🤝 **Push.** Your **${fmt(game.wager)}** coins were refunded.`; color = config.colors.warning; }
  else { status = `😢 **Dealer wins.** You lost **${fmt(game.wager)}** coins.`; color = config.colors.error; }

  if (payout > 0) Economy.changeWallet(interaction.guildId, interaction.user.id, payout);
  bjGames.delete(key);

  const wallet = walletOf(interaction.guildId, interaction.user.id);
  const embed = bjEmbed(game, { hideDealer: false, status: `${status}\n\n💰 Balance: **${fmt(wallet)}** coins`, color });
  const again = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`arcade:bj:${game.wager}:${interaction.user.id}`).setLabel(`Play Again (${fmt(game.wager)})`).setEmoji('🔁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`arcade:menu:0:${interaction.user.id}`).setLabel('Arcade').setEmoji('🕹️').setStyle(ButtonStyle.Secondary),
  );

  if (isNew) return interaction.reply({ embeds: [embed], components: [again] });
  return interaction.update({ embeds: [embed], components: [again] });
}

async function handleBlackjackButton(interaction, move, ownerId, sid) {
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ embeds: [Embed.error('Not Your Game', 'Start your own from the `/games` arcade!')], ephemeral: true });
  }
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const game = bjGames.get(key);
  if (!game || game.sid !== sid) {
    return interaction.update({ embeds: [Embed.warning('Game Expired', 'That hand is over — start a new one from `/games`.')], components: [] });
  }
  armBjTimeout(interaction, key, game);

  if (move === 'hit') {
    game.player.push(game.deck.pop());
    if (handValue(game.player) >= 21) return settleBlackjack(interaction, key, game);
    return interaction.update({ embeds: [bjEmbed(game)], components: [bjButtons(ownerId, game.sid)] });
  }
  if (move === 'double') {
    if (walletOf(interaction.guildId, interaction.user.id) < game.wager) {
      return interaction.reply({ embeds: [Embed.error('Not Enough Coins', 'You can\'t afford to double down.')], ephemeral: true });
    }
    Economy.changeWallet(interaction.guildId, interaction.user.id, -game.wager);
    game.wager *= 2;
    game.player.push(game.deck.pop());
    return settleBlackjack(interaction, key, game);
  }
  // stand
  return settleBlackjack(interaction, key, game);
}

// ─── Roulette ───────────────────────────────────────────────────────────────

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function rouletteRow(wager, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rl:red:${wager}:${userId}`).setLabel('Red ×2').setEmoji('🔴').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rl:black:${wager}:${userId}`).setLabel('Black ×2').setEmoji('⚫').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rl:even:${wager}:${userId}`).setLabel('Even ×2').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rl:odd:${wager}:${userId}`).setLabel('Odd ×2').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`rl:green:${wager}:${userId}`).setLabel('Green 0 ×14').setEmoji('🟢').setStyle(ButtonStyle.Success),
  );
}

async function startRoulette(interaction, wager) {
  if (walletOf(interaction.guildId, interaction.user.id) < wager) return insufficient(interaction, wager);
  return interaction.reply({
    embeds: [Embed.base({
      color: config.colors.game,
      title: '🎡 Roulette',
      description: `Betting **${fmt(wager)}** coins — place your bet!\n\n🔴 Red / ⚫ Black — pays **×2**\n🔢 Even / Odd — pays **×2**\n🟢 Green 0 — pays **×14**`,
      footer: 'European wheel · one zero',
    })],
    components: [rouletteRow(wager, interaction.user.id)],
  });
}

async function handleRouletteButton(interaction, bet, wager, ownerId) {
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ embeds: [Embed.error('Not Your Table', 'Start your own spin from the `/games` arcade!')], ephemeral: true });
  }
  wager = Number(wager);
  if (walletOf(interaction.guildId, interaction.user.id) < wager) {
    return interaction.update({ embeds: [Embed.error('Not Enough Coins', 'Your balance dropped below the bet.')], components: [] });
  }

  const n = Math.floor(Math.random() * 37); // 0-36
  const color = n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black';
  const colorEmoji = color === 'green' ? '🟢' : color === 'red' ? '🔴' : '⚫';

  let win = false, multiplier = 0;
  if (bet === 'red' && color === 'red') { win = true; multiplier = 2; }
  else if (bet === 'black' && color === 'black') { win = true; multiplier = 2; }
  else if (bet === 'even' && n !== 0 && n % 2 === 0) { win = true; multiplier = 2; }
  else if (bet === 'odd' && n % 2 === 1) { win = true; multiplier = 2; }
  else if (bet === 'green' && n === 0) { win = true; multiplier = 14; }

  const payout = win ? wager * multiplier : 0;
  Economy.changeWallet(interaction.guildId, interaction.user.id, payout - wager);
  const wallet = walletOf(interaction.guildId, interaction.user.id);

  // Little wheel strip for drama
  const strip = Array.from({ length: 5 }, () => Math.floor(Math.random() * 37));
  const stripStr = [...strip, n].map((x, i, arr) =>
    i === arr.length - 1 ? `**[ ${x} ]**` : `${x}`).join(' → ');

  const embed = Embed.base({
    color: win ? config.colors.success : config.colors.error,
    title: '🎡 Roulette',
    description: [
      `${stripStr}`,
      '',
      `The ball landed on ${colorEmoji} **${n}**!`,
      '',
      win
        ? `🎉 **You won ${fmt(payout)} coins!** (bet: ${bet} ×${multiplier})`
        : `😢 **You lost ${fmt(wager)} coins.** (bet: ${bet})`,
      '',
      `💰 Balance: **${fmt(wallet)}** coins`,
    ].join('\n'),
    footer: 'Roulette',
  });

  const again = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`arcade:rl:${wager}:${ownerId}`).setLabel(`Spin Again (${fmt(wager)})`).setEmoji('🔁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`arcade:menu:0:${ownerId}`).setLabel('Arcade').setEmoji('🕹️').setStyle(ButtonStyle.Secondary),
  );
  return interaction.update({ embeds: [embed], components: [again] });
}

// ─── Coinflip bet ───────────────────────────────────────────────────────────

function coinflipRow(wager, userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cfb:h:${wager}:${userId}`).setLabel('Heads').setEmoji('🪙').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`cfb:t:${wager}:${userId}`).setLabel('Tails').setEmoji('🌑').setStyle(ButtonStyle.Secondary),
  );
}

async function startCoinflipBet(interaction, wager) {
  if (walletOf(interaction.guildId, interaction.user.id) < wager) return insufficient(interaction, wager);
  return interaction.reply({
    embeds: [Embed.base({
      color: config.colors.game,
      title: '🪙 Coinflip — Double or Nothing',
      description: `Betting **${fmt(wager)}** coins. Call it!`,
      footer: 'Correct call pays ×2',
    })],
    components: [coinflipRow(wager, interaction.user.id)],
  });
}

async function handleCoinflipBet(interaction, call, wager, ownerId) {
  if (interaction.user.id !== ownerId) {
    return interaction.reply({ embeds: [Embed.error('Not Your Coin', 'Start your own flip from the `/games` arcade!')], ephemeral: true });
  }
  wager = Number(wager);
  if (walletOf(interaction.guildId, interaction.user.id) < wager) {
    return interaction.update({ embeds: [Embed.error('Not Enough Coins', 'Your balance dropped below the bet.')], components: [] });
  }
  const result = Math.random() < 0.5 ? 'h' : 't';
  const resultName = result === 'h' ? '🪙 **HEADS**' : '🌑 **TAILS**';
  const win = call === result;
  const payout = win ? wager * 2 : 0;
  Economy.changeWallet(interaction.guildId, interaction.user.id, payout - wager);
  const wallet = walletOf(interaction.guildId, interaction.user.id);

  const embed = Embed.base({
    color: win ? config.colors.success : config.colors.error,
    title: '🪙 Coinflip — Double or Nothing',
    description: [
      `The coin lands on… ${resultName}!`,
      '',
      win ? `🎉 **You called it! Won ${fmt(payout)} coins!**` : `😢 **Wrong call. Lost ${fmt(wager)} coins.**`,
      '',
      `💰 Balance: **${fmt(wallet)}** coins`,
    ].join('\n'),
    footer: 'Coinflip',
  });
  const again = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`arcade:cf:${wager}:${ownerId}`).setLabel(`Flip Again (${fmt(wager)})`).setEmoji('🔁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`arcade:menu:0:${ownerId}`).setLabel('Arcade').setEmoji('🕹️').setStyle(ButtonStyle.Secondary),
  );
  return interaction.update({ embeds: [embed], components: [again] });
}

// ─── High-Low dice duel vs the bot ─────────────────────────────────────────

async function startDiceDuel(interaction, wager) {
  if (walletOf(interaction.guildId, interaction.user.id) < wager) return insufficient(interaction, wager);

  const you = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  const bot = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  const win = you > bot;
  const tie = you === bot;
  const payout = win ? wager * 2 : tie ? wager : 0;
  Economy.changeWallet(interaction.guildId, interaction.user.id, payout - wager);
  const wallet = walletOf(interaction.guildId, interaction.user.id);

  const embed = Embed.base({
    color: win ? config.colors.success : tie ? config.colors.warning : config.colors.error,
    title: '🎲 Dice Duel',
    description: [
      `You rolled 🎲 **${you}** — Loopy rolled 🎲 **${bot}**`,
      '',
      win ? `🎉 **You won ${fmt(payout)} coins!**`
        : tie ? `🤝 **Tie!** Your **${fmt(wager)}** coins were refunded.`
          : `😢 **Loopy wins. Lost ${fmt(wager)} coins.**`,
      '',
      `💰 Balance: **${fmt(wallet)}** coins`,
    ].join('\n'),
    footer: 'Dice Duel · 2d6 vs 2d6, high roll wins ×2',
  });
  const again = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`arcade:dd:${wager}:${interaction.user.id}`).setLabel(`Roll Again (${fmt(wager)})`).setEmoji('🔁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`arcade:menu:0:${interaction.user.id}`).setLabel('Arcade').setEmoji('🕹️').setStyle(ButtonStyle.Secondary),
  );
  return interaction.reply({ embeds: [embed], components: [again] });
}

// ─── Slots (shared with /slots command) ────────────────────────────────────

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '⭐', '🎰', '🎯'];

async function playSlots(interaction, wager, viaButton = false) {
  const { guildId, user } = interaction;
  if (walletOf(guildId, user.id) < wager) return insufficient(interaction, wager);

  const s = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  const [a, b, c] = [s(), s(), s()];
  let payout = 0, result, color;
  if (a === b && b === c) {
    payout = wager * (a === '💎' || a === '🎰' ? 12 : 8);
    result = `🎰 **JACKPOT!** Triple ${a} pays **${fmt(payout)}** coins!`;
    color = config.colors.gold;
  } else if (a === b || b === c || a === c) {
    payout = wager * 2;
    result = `✨ **Pair!** You won **${fmt(payout)}** coins!`;
    color = config.colors.success;
  } else {
    result = `😢 No match — lost **${fmt(wager)}** coins.`;
    color = config.colors.error;
  }
  Economy.changeWallet(guildId, user.id, payout - wager);
  const wallet = walletOf(guildId, user.id);

  const spinFrame = (x, y, z) => [
    '```',
    '┌───────────────┐',
    `│  ${x}  │  ${y}  │  ${z}  │`,
    '└───────────────┘',
    '```',
  ].join('\n');

  const finalEmbed = Embed.base({
    color,
    title: '🎰 Slot Machine',
    description: `${spinFrame(a, b, c)}\n${result}\n\n💰 Balance: **${fmt(wallet)}** coins`,
    footer: 'Triple 💎/🎰 ×12 · other triples ×8 · pairs ×2',
  });
  const again = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`arcade:slots:${wager}:${user.id}`).setLabel(`Spin Again (${fmt(wager)})`).setEmoji('🔁').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`arcade:menu:0:${user.id}`).setLabel('Arcade').setEmoji('🕹️').setStyle(ButtonStyle.Secondary),
  );

  // Animated spin: show spinning frame, then reveal.
  const spinningEmbed = Embed.base({
    color: config.colors.game,
    title: '🎰 Slot Machine',
    description: `${spinFrame('🌀', '🌀', '🌀')}\n**Spinning…**`,
    footer: `Wager: ${fmt(wager)} coins`,
  });

  if (viaButton) {
    await interaction.update({ embeds: [spinningEmbed], components: [] });
    await new Promise(r => setTimeout(r, 1200));
    return interaction.editReply({ embeds: [finalEmbed], components: [again] });
  }
  await interaction.reply({ embeds: [spinningEmbed] });
  await new Promise(r => setTimeout(r, 1200));
  return interaction.editReply({ embeds: [finalEmbed], components: [again] });
}

module.exports = {
  WAGERS,
  wagerRow,
  startBlackjack,
  handleBlackjackButton,
  startRoulette,
  handleRouletteButton,
  startCoinflipBet,
  handleCoinflipBet,
  startDiceDuel,
  playSlots,
};
