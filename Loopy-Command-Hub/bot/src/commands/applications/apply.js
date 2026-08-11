const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const config = require('../../config');

async function handleApplyModal(interaction, appType) {}

module.exports = {
  data: new SlashCommandBuilder().setName('apply').setDescription('Apply for a position')
    .addStringOption(o => o.setName('type').setDescription('Application type name').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const typeName = interaction.options.getString('type').toLowerCase();
    const gid = interaction.guildId;
    const appType = db.prepare('SELECT * FROM application_types WHERE guild_id = ? AND name = ?').get(gid, typeName);
    if (!appType) return interaction.editReply({ embeds: [Embed.error('Not Found', `Application type \`${typeName}\` not found. Use \`/applysetup list\` to see available types.`)] });
    if (!appType.is_open) return interaction.editReply({ embeds: [Embed.error('Closed', `Applications for **${appType.label}** are currently closed.`)] });
    const existing = db.prepare("SELECT id FROM applications WHERE guild_id = ? AND user_id = ? AND type = ? AND status = 'pending'").get(gid, interaction.user.id, typeName);
    if (existing) return interaction.editReply({ embeds: [Embed.warning('Already Applied', `You already have a pending application for **${appType.label}**.`)] });

    const questions = JSON.parse(appType.questions);
    const answers = [];
    let dmChannel;
    try {
      dmChannel = await interaction.user.createDM();
      await dmChannel.send({ embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle(`📋 ${appType.label} Application`).setDescription(`You have **${questions.length}** questions to answer. Type your response for each one.\n\nYou have **2 minutes** per question.`).setFooter({ text: 'Application started' }).setTimestamp()] });
    } catch {
      return interaction.editReply({ embeds: [Embed.error('DMs Closed', 'Please enable DMs from server members to complete your application.')] });
    }
    await interaction.editReply({ embeds: [Embed.info('Application Started', 'Check your DMs to answer the application questions!')] });

    for (let i = 0; i < questions.length; i++) {
      await dmChannel.send({ embeds: [new EmbedBuilder().setColor(config.colors.primary).setTitle(`Question ${i+1}/${questions.length}`).setDescription(questions[i]).setFooter({ text: 'Type your answer below' })] });
      try {
        const collected = await dmChannel.awaitMessages({ filter: m => m.author.id === interaction.user.id, max: 1, time: 120000, errors: ['time'] });
        answers.push(collected.first().content);
      } catch {
        await dmChannel.send({ embeds: [Embed.error('Timed Out', 'You took too long to answer. Application cancelled.')] });
        return;
      }
    }

    const appId = db.prepare('INSERT INTO applications (guild_id, user_id, type, answers) VALUES (?, ?, ?, ?)').run(gid, interaction.user.id, typeName, JSON.stringify(answers)).lastInsertRowid;
    await dmChannel.send({ embeds: [Embed.success('Application Submitted!', `Your **${appType.label}** application has been submitted!\n\n**Application ID:** #${appId}\n\nYou will be notified of the decision via DM.`)] });

    const resultCh = interaction.guild.channels.cache.get(appType.result_channel_id);
    if (resultCh) {
      const reviewEmbed = new EmbedBuilder().setColor(config.colors.primary)
        .setTitle(`📋 New Application — ${appType.label}`)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Applicant', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
          { name: '🆔 Application ID', value: `#${appId}`, inline: true },
          ...questions.map((q, i) => ({ name: `Q${i+1}: ${q.slice(0,100)}`, value: answers[i]?.slice(0, 1000) || 'No answer' }))
        ).setTimestamp().setFooter({ text: `Application #${appId}` });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`app_accept:${appId}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId(`app_deny:${appId}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
      );
      await resultCh.send({ content: JSON.parse(appType.reviewer_role_ids).map(id => `<@&${id}>`).join(' '), embeds: [reviewEmbed], components: [row] });
    }
  },
  handleApplyModal,
};
