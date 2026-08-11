const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const AI = require('../../utils/ai');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder().setName('backgroundcheck').setDescription('Run a background check on a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(target.id);
    const gid = interaction.guildId;
    const warns = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE guild_id = ? AND user_id = ?').get(gid, target.id);
    const logs = db.prepare('SELECT action, reason, created_at FROM mod_logs WHERE guild_id = ? AND target_id = ? ORDER BY created_at DESC LIMIT 10').all(gid, target.id);
    const verification = db.prepare('SELECT roblox_username FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(gid, target.id);
    const data = {
      username: target.tag, userId: target.id,
      accountCreated: new Date(target.createdTimestamp).toISOString(),
      serverJoined: member ? new Date(member.joinedTimestamp).toISOString() : 'Unknown',
      warnings: warns.c,
      modActions: logs.map(l => `${l.action}: ${l.reason}`),
      robloxUsername: verification?.roblox_username || 'Not verified',
      isBot: target.bot,
    };
    const summary = await AI.summarizeBackgroundCheck(data);
    const embed = new EmbedBuilder().setColor(config.colors.primary)
      .setTitle(`🔍 Background Check — ${target.tag}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '📋 Basic Info', value: `**ID:** ${target.id}\n**Created:** <t:${Math.floor(target.createdTimestamp / 1000)}:R>\n**Joined:** ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown'}`, inline: true },
        { name: '⚠️ Mod History', value: `**Warnings:** ${warns.c}\n**Actions:** ${logs.length}`, inline: true },
        { name: '🟥 Roblox', value: verification?.roblox_username || 'Not verified', inline: true },
        { name: '🤖 AI Summary', value: summary?.slice(0, 1000) || 'Could not generate summary.' },
      ).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  },
};
