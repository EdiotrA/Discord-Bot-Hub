const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { db, getSetting } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View all bot settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const gid = interaction.guildId;
    const get = (k, fallback = 'Not set') => { const v = getSetting(gid, k); return v ? (k.endsWith('_channel') || k.endsWith('_role') ? `<#${v}> / <@&${v}>` : String(v)) : fallback; };
    const ch = (k) => { const v = getSetting(gid, k); return v ? `<#${v}>` : '*(not set)*'; };
    const rl = (k) => { const v = getSetting(gid, k); return v ? `<@&${v}>` : '*(not set)*'; };
    const bool = (k) => getSetting(gid, k) !== false && getSetting(gid, k) !== 'false' ? '🟢 Enabled' : '🔴 Disabled';
    const embed = new EmbedBuilder().setColor(config.colors.primary).setTitle('⚙️ Loopy Bot Settings')
      .addFields(
        { name: '📋 Channels', value: `Log: ${ch('log_channel')}\nWelcome: ${ch('welcome_channel')}\nLevel Up: ${ch('levelup_channel')}\nRank Log: ${ch('rank_log_channel')}\nLOA: ${ch('loa_channel')}`, inline: true },
        { name: '🎭 Roles', value: `Mute: ${rl('mute_role')}\nAuto: ${rl('auto_role')}\nVerified: ${rl('verified_role')}`, inline: true },
        { name: '🛡️ Protection', value: `Anti-Scam: ${bool('antiscam_enabled')}\nAnti-Link: ${bool('antilink_enabled')}\nPing Protection: ${bool('ping_protection_enabled')}\nRules Enforcement: ${bool('rules_enforcement_enabled')}`, inline: false },
        { name: '🎮 Systems', value: `EXP System: ${bool('exp_enabled')}\nRoblox Group: ${getSetting(gid, 'roblox_group_id') || '*(not set)*'}`, inline: true },
        { name: '🎫 Tickets', value: (() => { const cats = db.prepare('SELECT COUNT(*) as c FROM ticket_categories WHERE guild_id = ?').get(gid); return `Categories: ${cats?.c || 0}`; })(), inline: true },
      ).setTimestamp().setFooter({ text: 'Use /setup to change settings' });
    await interaction.editReply({ embeds: [embed] });
  },
};
