const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { getSetting, setSetting } = require('../../database');
const AntiScam = require('../../utils/antiScam');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antiscam')
    .setDescription('Configure scam link protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('enable').setDescription('Enable scam link detection'))
    .addSubcommand(s => s.setName('disable').setDescription('Disable scam link detection'))
    .addSubcommand(s => s.setName('adddomain').setDescription('Blacklist a domain')
      .addStringOption(o => o.setName('domain').setDescription('Domain to block (e.g. scam.com)').setRequired(true)))
    .addSubcommand(s => s.setName('removedomain').setDescription('Remove a domain from blacklist')
      .addStringOption(o => o.setName('domain').setDescription('Domain to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List blacklisted domains')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    if (sub === 'enable') { setSetting(gid, 'antiscam_enabled', true); return interaction.editReply({ embeds: [Embed.success('Anti-Scam Enabled', 'Scam link detection is now **on**.')] }); }
    if (sub === 'disable') { setSetting(gid, 'antiscam_enabled', false); return interaction.editReply({ embeds: [Embed.warning('Anti-Scam Disabled', 'Scam link detection is now **off**.')] }); }
    if (sub === 'adddomain') {
      const domain = AntiScam.addDomain(gid, interaction.options.getString('domain'), interaction.user.id);
      return interaction.editReply({ embeds: [Embed.success('Domain Blacklisted', `\`${domain}\` has been added to the scam blacklist.`)] });
    }
    if (sub === 'removedomain') {
      const domain = AntiScam.removeDomain(gid, interaction.options.getString('domain'));
      return interaction.editReply({ embeds: [Embed.success('Domain Removed', `\`${domain}\` removed from blacklist.`)] });
    }
    if (sub === 'list') {
      const domains = AntiScam.getDomains(gid);
      const desc = domains.length ? domains.map(d => `\`${d.domain}\``).join(', ') : 'No custom domains blacklisted.';
      return interaction.editReply({ embeds: [Embed.info('Blacklisted Domains', desc)] });
    }
  },
};
