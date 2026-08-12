const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { getSetting, setSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure join-burst raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('enable').setDescription('Enable raid protection'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable raid protection'))
    .addSubcommand(s => s.setName('configure').setDescription('Set the join threshold and response')
      .addIntegerOption(o => o.setName('joins').setDescription('Joins inside the window that trigger protection').setRequired(true).setMinValue(2).setMaxValue(100))
      .addIntegerOption(o => o.setName('window').setDescription('Window in seconds').setRequired(true).setMinValue(5).setMaxValue(300))
      .addStringOption(o => o.setName('action').setDescription('What to do while the burst is active').setRequired(true)
        .addChoices({ name: 'Log only', value: 'log' }, { name: 'Timeout new members', value: 'timeout' })))
    .addSubcommand(s => s.setName('status').setDescription('View raid protection status')),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();
    if (sub === 'enable' || sub === 'disable') {
      const enabled = sub === 'enable';
      setSetting(guildId, 'antiraid_enabled', enabled);
      return interaction.reply({ embeds: [Embed.success(`Anti-Raid ${enabled ? 'Enabled' : 'Disabled'}`, enabled
        ? 'Loopy will watch for rapid join bursts and log or timeout new members according to your settings.'
        : 'Join-burst protection is now disabled.')], ephemeral: true });
    }
    if (sub === 'configure') {
      const joins = interaction.options.getInteger('joins');
      const window = interaction.options.getInteger('window');
      const action = interaction.options.getString('action');
      setSetting(guildId, 'antiraid_threshold', joins);
      setSetting(guildId, 'antiraid_window_seconds', window);
      setSetting(guildId, 'antiraid_action', action);
      return interaction.reply({ embeds: [Embed.success('Anti-Raid Configured', `Trigger after **${joins} joins** within **${window} seconds**.\nResponse: **${action === 'timeout' ? 'Timeout new members' : 'Log only'}**.\n\nUse \`/antiraid enable\` when ready.`)], ephemeral: true });
    }
    const enabled = Boolean(getSetting(guildId, 'antiraid_enabled'));
    const joins = getSetting(guildId, 'antiraid_threshold', 5);
    const window = getSetting(guildId, 'antiraid_window_seconds', 10);
    const action = getSetting(guildId, 'antiraid_action', 'log');
    return interaction.reply({ embeds: [Embed.info('Anti-Raid Status', `**Status:** ${enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Trigger:** ${joins} joins / ${window} seconds\n**Response:** ${action === 'timeout' ? 'Timeout new members' : 'Log only'}`)], ephemeral: true });
  },
};