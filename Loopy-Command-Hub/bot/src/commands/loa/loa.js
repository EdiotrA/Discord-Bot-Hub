const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const config = require('../../config');

async function handleLoaModal(interaction) {}

module.exports = {
  data: new SlashCommandBuilder().setName('loa').setDescription('Submit a Leave of Absence request')
    .addStringOption(o => o.setName('reason').setDescription('Reason for LOA').setRequired(true))
    .addStringOption(o => o.setName('startdate').setDescription('Start date (YYYY-MM-DD)').setRequired(true))
    .addStringOption(o => o.setName('enddate').setDescription('End date (YYYY-MM-DD)').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const reason = interaction.options.getString('reason');
    const startStr = interaction.options.getString('startdate');
    const endStr = interaction.options.getString('enddate');
    const start = Math.floor(new Date(startStr).getTime() / 1000);
    const end = Math.floor(new Date(endStr).getTime() / 1000);
    if (isNaN(start) || isNaN(end)) return interaction.editReply({ embeds: [Embed.error('Invalid Date', 'Use YYYY-MM-DD format (e.g. 2024-01-15).')] });
    if (end <= start) return interaction.editReply({ embeds: [Embed.error('Invalid Dates', 'End date must be after start date.')] });

    const id = db.prepare('INSERT INTO loa_requests (guild_id, user_id, reason, start_date, end_date) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, interaction.user.id, reason, start, end).lastInsertRowid;
    const loaChannel = getSetting(interaction.guildId, 'loa_channel');
    if (loaChannel) {
      const ch = interaction.guild.channels.cache.get(loaChannel);
      if (ch) {
        const embed = new EmbedBuilder().setColor(config.colors.warning).setTitle('📅  LOA Request')
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setDescription(`> **Member:** ${interaction.user.tag} (<@${interaction.user.id}>)\n> **Request ID:** \`#${id}\``)
          .addFields(
            Embed.field('📋 Reason', reason, false),
            Embed.field('📅 Start', `<t:${start}:D>`, true),
            Embed.field('📅 End', `<t:${end}:D>`, true),
          ).setFooter(Embed.brandFooter('Leave of Absence')).setTimestamp();
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`loa_accept:${id}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('✅'),
          new ButtonBuilder().setCustomId(`loa_deny:${id}`).setLabel('Deny').setStyle(ButtonStyle.Danger).setEmoji('❌'),
        );
        const reviewerRole = getSetting(interaction.guildId, 'loa_reviewer_role');
        await ch.send({ content: reviewerRole ? `<@&${reviewerRole}>` : undefined, embeds: [embed], components: [row] });
      }
    }
    await interaction.editReply({ embeds: [Embed.success('LOA Submitted', `Your LOA request (\`#${id}\`) has been submitted!\n\n> **From:** <t:${start}:D>\n> **To:** <t:${end}:D>\n\nYou will be notified of the decision via DM.`)] });
  },
  handleLoaModal,
};
