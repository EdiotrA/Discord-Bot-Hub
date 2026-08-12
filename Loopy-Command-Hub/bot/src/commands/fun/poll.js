const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const { db } = require('../../database');

const NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
const BAR_LENGTH = 12;

function renderBar(count, total) {
  const ratio = total > 0 ? count / total : 0;
  const filled = Math.round(ratio * BAR_LENGTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_LENGTH - filled);
}

function tally(messageId, optionCount) {
  const rows = db.prepare('SELECT option_index, COUNT(*) AS votes FROM poll_votes WHERE message_id = ? GROUP BY option_index').all(messageId);
  const counts = Array.from({ length: optionCount }, () => 0);
  for (const row of rows) if (row.option_index < optionCount) counts[row.option_index] = row.votes;
  return counts;
}

function buildPollEmbed(poll, { final = false } = {}) {
  const options = JSON.parse(poll.options);
  const counts = tally(poll.message_id, options.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const lines = options.map((option, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
    return `${NUMS[i]} **${option}**\n\`${renderBar(counts[i], total)}\` ${counts[i]} vote${counts[i] === 1 ? '' : 's'} · ${pct}%`;
  });
  const embed = new EmbedBuilder()
    .setColor(final ? config.colors.gold : config.colors.primary)
    .setTitle(`📊 ${poll.question}`)
    .setDescription(lines.join('\n\n'))
    .setTimestamp();
  if (final) {
    const max = Math.max(...counts);
    const winners = total > 0 ? options.filter((_, i) => counts[i] === max) : [];
    embed.addFields({ name: '🏆 Result', value: winners.length ? winners.map(w => `**${w}**`).join(' tied with ') : 'No votes were cast.' });
    embed.setFooter({ text: `Poll ended • ${total} total vote${total === 1 ? '' : 's'}` });
  } else {
    embed.setFooter({ text: `Vote with the buttons below • Ends` });
    embed.addFields({ name: '\u200b', value: `Ends <t:${poll.ends_at}:R> • Hosted by <@${poll.author_id}>` });
  }
  return embed;
}

function buildPollButtons(poll, disabled = false) {
  const options = JSON.parse(poll.options);
  const row = new ActionRowBuilder();
  options.forEach((_, i) => {
    row.addComponents(new ButtonBuilder().setCustomId(`poll_vote:${i}`).setEmoji(NUMS[i]).setStyle(ButtonStyle.Secondary).setDisabled(disabled));
  });
  return [row];
}

async function endPoll(client, messageId) {
  const poll = db.prepare('SELECT * FROM polls WHERE message_id = ? AND ended = 0').get(messageId);
  if (!poll) return;
  db.prepare('UPDATE polls SET ended = 1 WHERE message_id = ?').run(messageId);
  try {
    const channel = await client.channels.fetch(poll.channel_id);
    const message = await channel.messages.fetch(poll.message_id);
    await message.edit({ embeds: [buildPollEmbed(poll, { final: true })], components: buildPollButtons(poll, true) });
  } catch (error) {
    console.error('[Poll] Failed to finalize poll:', error.message);
  }
}

const MAX_TIMEOUT = 2 ** 31 - 1;

function schedulePoll(client, poll) {
  const delay = Math.max(0, poll.ends_at * 1000 - Date.now());
  if (delay > MAX_TIMEOUT) {
    setTimeout(() => schedulePoll(client, poll), MAX_TIMEOUT);
  } else {
    setTimeout(() => endPoll(client, poll.message_id), delay);
  }
}

async function handlePollVote(interaction, optionIndex) {
  const poll = db.prepare('SELECT * FROM polls WHERE message_id = ?').get(interaction.message.id);
  if (!poll || poll.ended || poll.ends_at * 1000 <= Date.now()) {
    return interaction.reply({ content: 'This poll has ended.', ephemeral: true });
  }
  const index = Number(optionIndex);
  const existing = db.prepare('SELECT option_index FROM poll_votes WHERE message_id = ? AND user_id = ?').get(poll.message_id, interaction.user.id);
  if (existing && existing.option_index === index) {
    db.prepare('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?').run(poll.message_id, interaction.user.id);
  } else {
    db.prepare('INSERT OR REPLACE INTO poll_votes (message_id, user_id, option_index) VALUES (?, ?, ?)').run(poll.message_id, interaction.user.id, index);
  }
  const options = JSON.parse(poll.options);
  const note = existing && existing.option_index === index
    ? 'Your vote was removed.'
    : `You voted for **${options[index]}**.`;
  await interaction.update({ embeds: [buildPollEmbed(poll)], components: buildPollButtons(poll) }).catch(() => {});
  await interaction.followUp({ content: note, ephemeral: true }).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder().setName('poll').setDescription('Create a poll with live button voting')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true).setMaxLength(200))
    .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true).setMaxLength(80))
    .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false).setMaxLength(80))
    .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false).setMaxLength(80))
    .addStringOption(o => o.setName('option5').setDescription('Option 5').setRequired(false).setMaxLength(80))
    .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes (default 60)').setRequired(false).setMinValue(1).setMaxValue(10080)),
  async execute(interaction) {
    const question = interaction.options.getString('question');
    const options = ['option1', 'option2', 'option3', 'option4', 'option5'].map(k => interaction.options.getString(k)).filter(Boolean);
    const minutes = interaction.options.getInteger('duration') || 60;
    const endsAt = Math.floor(Date.now() / 1000) + minutes * 60;

    await interaction.deferReply();
    const message = await interaction.fetchReply();
    const poll = {
      message_id: message.id,
      guild_id: interaction.guildId,
      channel_id: interaction.channelId,
      author_id: interaction.user.id,
      question,
      options: JSON.stringify(options),
      ends_at: endsAt,
      ended: 0,
    };
    db.prepare('INSERT INTO polls (message_id, guild_id, channel_id, author_id, question, options, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(poll.message_id, poll.guild_id, poll.channel_id, poll.author_id, poll.question, poll.options, poll.ends_at);
    await interaction.editReply({ embeds: [buildPollEmbed(poll)], components: buildPollButtons(poll) });
    schedulePoll(interaction.client, poll);
  },
  handlePollVote,
  schedulePoll,
  endPoll,
};
