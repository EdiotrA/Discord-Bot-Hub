const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const AI = require('../../utils/ai');

async function handleVerifyModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const username = interaction.fields.getTextInputValue('roblox_username');
  const gid = interaction.guild.id;
  const user = await Roblox.getUserByUsername(username);
  if (!user) return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find Roblox user \`${username}\`. Check spelling.`)] });

  const code = Roblox.generateVerifyCode(interaction.user.id);
  const hasCode = await Roblox.checkVerifyCode(user.id, code);
  if (!hasCode) {
    return interaction.editReply({ embeds: [Embed.warning('Code Not Found', `Please add this code to your **Roblox profile bio** then run \`/verify\` again:\n\n\`\`\`${code}\`\`\`\n\nGo to: **Roblox → Profile → Edit → About → paste the code → Save**`)] });
  }

  // Check AI verify questions
  const questions = db.prepare('SELECT question FROM verify_questions WHERE guild_id = ? ORDER BY order_num').all(gid).map(r => r.question);
  if (questions.length > 0) {
    const context = getSetting(gid, 'verify_context') || '';
    let dmChannel;
    try { dmChannel = await interaction.user.createDM(); } catch { return interaction.editReply({ embeds: [Embed.error('DMs Closed', 'Enable DMs to complete verification.')] }); }
    await interaction.editReply({ embeds: [Embed.info('Verification', 'Please check your DMs to answer a few questions.')] });
    const answers = [];
    for (const q of questions) {
      await dmChannel.send({ embeds: [Embed.info('Verify Question', q)] });
      try {
        const col = await dmChannel.awaitMessages({ filter: m => m.author.id === interaction.user.id, max: 1, time: 90000, errors: ['time'] });
        answers.push(col.first().content);
      } catch { await dmChannel.send({ embeds: [Embed.error('Timed Out', 'Verification cancelled.')] }); return; }
    }
    const result = await AI.evaluateVerifyAnswers(questions, answers, context);
    if (!result.approved) {
      await dmChannel.send({ embeds: [Embed.error('Verification Failed', `Your answers did not meet the requirements.\n**Reason:** ${result.reason}`)] });
      return;
    }
  }

  // Save verification
  db.prepare('INSERT OR REPLACE INTO verifications (guild_id, discord_user_id, roblox_user_id, roblox_username) VALUES (?, ?, ?, ?)').run(gid, interaction.user.id, String(user.id), user.name);
  const verifiedRole = getSetting(gid, 'verified_role');
  if (verifiedRole) { const role = interaction.guild.roles.cache.get(verifiedRole); if (role) await interaction.member.roles.add(role).catch(() => {}); }
  const thumbnail = await Roblox.getUserThumbnail(user.id);
  await interaction.editReply({ embeds: [Embed.roblox('Verified! ✅', `You are now verified as **${user.name}**.`, [{ name: 'Roblox ID', value: String(user.id), inline: true }], thumbnail)] });
}

function buildVerifyModal() {
  return new ModalBuilder().setCustomId('verify_modal').setTitle('Roblox Verification')
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('roblox_username')
        .setLabel('Your Roblox Username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('e.g. BuilderMan'),
    ));
}

module.exports = {
  data: new SlashCommandBuilder().setName('verify').setDescription('Verify your Roblox account'),
  async execute(interaction) {
    const existing = db.prepare('SELECT roblox_username FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(interaction.guildId, interaction.user.id);
    if (existing) return interaction.reply({ embeds: [Embed.warning('Already Verified', `You are already verified as **${existing.roblox_username}**. Use \`/unverify\` to reset.`)], ephemeral: true });
    await interaction.showModal(buildVerifyModal());
  },
  handleVerifyModal,
  buildVerifyModal,
};
