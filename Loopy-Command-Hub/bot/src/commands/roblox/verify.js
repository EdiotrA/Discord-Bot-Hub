const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const Roblox = require('../../utils/roblox');
const AI = require('../../utils/ai');

// Members who clicked "I've Joined" for servers Loopy cannot check directly.
const joinAcks = new Set();

async function handleVerifyJoined(interaction) {
  joinAcks.add(`${interaction.guild.id}:${interaction.user.id}`);
  return interaction.showModal(buildVerifyModal());
}

async function logVerification(interaction, description, success = true) {
  const channelId = getSetting(interaction.guild.id, 'verify_log_channel');
  if (!channelId) return;
  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel) return;
  const embed = success
    ? Embed.success('Verification Log', description)
    : Embed.warning('Verification Log', description);
  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function handleVerifyModal(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const username = interaction.fields.getTextInputValue('roblox_username');
  const gid = interaction.guild.id;
  const user = await Roblox.getUserByUsername(username);
  if (!user) {
    await logVerification(interaction, `❌ <@${interaction.user.id}> attempted verification with unknown Roblox username \`${username.slice(0, 60)}\`.`, false);
    return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find Roblox user \`${username}\`. Check spelling.`)] });
  }

  const code = Roblox.generateVerifyCode(interaction.user.id);
  const hasCode = await Roblox.checkVerifyCode(user.id, code);
  if (!hasCode) {
    return interaction.editReply({ embeds: [Embed.warning('Code Not Found', `Please add this code to your **Roblox profile bio** then run \`/verify\` again:\n\n\`\`\`${code}\`\`\`\n\nGo to: **Roblox → Profile → Edit → About → paste the code → Save**`)] });
  }

  // Required server joins (configured with /setup verifyjoinserver)
  const joinServers = getSetting(gid, 'verify_join_servers') || [];
  if (Array.isArray(joinServers) && joinServers.length) {
    const pending = [];
    for (const invite of joinServers) {
      try {
        const resolved = await interaction.client.fetchInvite(invite);
        const targetGuild = resolved.guild ? interaction.client.guilds.cache.get(resolved.guild.id) : null;
        if (targetGuild) {
          // Loopy is in the target server — check membership directly.
          const member = await targetGuild.members.fetch(interaction.user.id).catch(() => null);
          if (!member) pending.push(invite);
        } else if (!joinAcks.has(`${gid}:${interaction.user.id}`)) {
          // Cannot check membership; require the member to confirm once.
          pending.push(invite);
        }
      } catch {
        if (!joinAcks.has(`${gid}:${interaction.user.id}`)) pending.push(invite);
      }
    }
    if (pending.length) {
      const rows = [new ActionRowBuilder().addComponents(
        ...pending.slice(0, 4).map((invite, i) => new ButtonBuilder().setLabel(pending.length === 1 ? 'Join Server' : `Join Server ${i + 1}`).setStyle(ButtonStyle.Link).setURL(invite)),
        new ButtonBuilder().setCustomId('verify_joined').setLabel("I've Joined — Continue").setStyle(ButtonStyle.Success),
      )];
      await logVerification(interaction, `⏳ <@${interaction.user.id}> (Roblox: **${user.name}**) was asked to join required server(s) before verifying.`, false);
      return interaction.editReply({
        embeds: [Embed.warning('One More Step', `To verify, you must join ${pending.length === 1 ? 'this server' : 'these servers'} first:\n${pending.map(s => `• ${s}`).join('\n')}\n\nJoin, then click **I've Joined — Continue**.`)],
        components: rows,
      });
    }
  }

  // Check AI verify questions
  const questions = db.prepare('SELECT question FROM verify_questions WHERE guild_id = ? ORDER BY order_num').all(gid).map(r => r.question);
  if (questions.length > 0) {
    const context = getSetting(gid, 'verify_context') || '';
    let dmChannel;
    try { dmChannel = await interaction.user.createDM(); } catch {
      await logVerification(interaction, `❌ <@${interaction.user.id}> could not complete verification as **${user.name}** — DMs are closed.`, false);
      return interaction.editReply({ embeds: [Embed.error('DMs Closed', 'Enable DMs to complete verification.')] });
    }
    await interaction.editReply({ embeds: [Embed.info('Verification', 'Please check your DMs to answer a few questions.')] });
    const answers = [];
    for (const q of questions) {
      await dmChannel.send({ embeds: [Embed.info('Verify Question', q)] });
      try {
        const col = await dmChannel.awaitMessages({ filter: m => m.author.id === interaction.user.id, max: 1, time: 90000, errors: ['time'] });
        answers.push(col.first().content);
      } catch {
        await dmChannel.send({ embeds: [Embed.error('Timed Out', 'Verification cancelled.')] });
        await logVerification(interaction, `❌ <@${interaction.user.id}> timed out answering verification questions as **${user.name}**.`, false);
        return;
      }
    }
    const result = await AI.evaluateVerifyAnswers(questions, answers, context);
    if (!result.approved) {
      await dmChannel.send({ embeds: [Embed.error('Verification Failed', `Your answers did not meet the requirements.\n**Reason:** ${result.reason}`)] });
      await logVerification(interaction, `❌ <@${interaction.user.id}> failed verification as Roblox user **${user.name}**.\n**Reason:** ${result.reason} (confidence: ${result.confidence})`, false);
      return;
    }
  }

  // Save verification
  db.prepare('INSERT OR REPLACE INTO verifications (guild_id, discord_user_id, roblox_user_id, roblox_username) VALUES (?, ?, ?, ?)').run(gid, interaction.user.id, String(user.id), user.name);
  const verifiedRole = getSetting(gid, 'verified_role');
  if (verifiedRole) { const role = interaction.guild.roles.cache.get(verifiedRole); if (role) await interaction.member.roles.add(role).catch(() => {}); }
  const thumbnail = await Roblox.getUserThumbnail(user.id);
  await interaction.editReply({ embeds: [Embed.roblox('Verified! ✅', `You are now verified as **${user.name}**.`, [{ name: 'Roblox ID', value: String(user.id), inline: true }], thumbnail)] });
  await logVerification(interaction, `✅ <@${interaction.user.id}> verified as Roblox user **${user.name}** (ID: ${user.id}).`);
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
  handleVerifyJoined,
  buildVerifyModal,
};
