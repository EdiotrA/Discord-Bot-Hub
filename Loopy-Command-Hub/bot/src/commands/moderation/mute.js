const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting } = require('../../database');
const ms = require('ms');

module.exports = {
  data: new SlashCommandBuilder().setName('mute').setDescription('Mute a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d) — max 28d').setRequired(false))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember('user');
    const dur = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!target) return interaction.editReply({ embeds: [Embed.error('Not Found', 'Member not found.')] });
    if (dur) {
      const msVal = ms(dur);
      if (!msVal || msVal > 2419200000) return interaction.editReply({ embeds: [Embed.error('Invalid Duration', 'Max timeout is 28 days.')] });
      await target.timeout(msVal, reason);
    } else {
      const muteRole = getSetting(interaction.guildId, 'mute_role');
      if (!muteRole) return interaction.editReply({ embeds: [Embed.error('No Mute Role', 'Set a mute role with `/setup muterole` or provide a duration.')] });
      await target.roles.add(muteRole, reason);
    }
    target.user.send({ embeds: [Embed.warning('Muted', `You were muted in **${interaction.guild.name}**.\n**Reason:** ${reason}${dur ? `\n**Duration:** ${dur}` : ''}`)] }).catch(() => {});
    db.prepare('INSERT INTO mod_logs (guild_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)').run(interaction.guildId, 'MUTE', interaction.user.id, target.id, reason);
    const logCh = getSetting(interaction.guildId, 'log_channel');
    if (logCh) { const ch = interaction.guild.channels.cache.get(logCh); if (ch) ch.send({ embeds: [Embed.moderation('Mute', target.user, interaction.user, reason, dur ? [{ name: 'Duration', value: dur, inline: true }] : [])] }); }
    await interaction.editReply({ embeds: [Embed.success('Member Muted', `**${target.user.tag}** has been muted.\n${dur ? `**Duration:** ${dur}` : '**Type:** Role mute'}`)] });
  },
};
