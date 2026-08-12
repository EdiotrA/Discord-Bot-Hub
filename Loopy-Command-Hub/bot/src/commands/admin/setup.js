const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const { getSetting, setSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure Loopy bot settings for this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('log').setDescription('Set the log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('welcome').setDescription('Set the welcome channel')
      .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('muterole').setDescription('Set the mute role')
      .addRoleOption(o => o.setName('role').setDescription('Mute role').setRequired(true)))
    .addSubcommand(s => s.setName('autorole').setDescription('Set auto-role for new members')
      .addRoleOption(o => o.setName('role').setDescription('Auto role').setRequired(true)))
    .addSubcommand(s => s.setName('levelupchannel').setDescription('Set where level-up messages post')
      .addChannelOption(o => o.setName('channel').setDescription('Level-up channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('welcomemessage').setDescription('Set the welcome message (use {user} {server} {membercount})')
      .addStringOption(o => o.setName('message').setDescription('Welcome message text').setRequired(true)))
    .addSubcommand(s => s.setName('verifiedrole').setDescription('Role given after Roblox verification')
      .addRoleOption(o => o.setName('role').setDescription('Verified role').setRequired(true)))
    .addSubcommand(s => s.setName('ranklogchannel').setDescription('Set the rank request log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Rank log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('verifylogchannel').setDescription('Set the verification log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Verification log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('verifyjoinserver').setDescription('Require joining a server during verification')
      .addStringOption(o => o.setName('invite').setDescription('Discord invite link members must join (e.g. https://discord.gg/abc)').setRequired(true)))
    .addSubcommand(s => s.setName('verifyjoinclear').setDescription('Remove all required servers from verification')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === 'verifyjoinserver') {
      const invite = interaction.options.getString('invite').trim();
      if (!/^https:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\/[\w-]+$/i.test(invite)) {
        return interaction.editReply({ embeds: [Embed.error('Invalid Invite', 'Please provide a valid Discord invite link like `https://discord.gg/abc123`.')] });
      }
      const list = getSetting(gid, 'verify_join_servers') || [];
      const servers = Array.isArray(list) ? list : [];
      if (!servers.includes(invite)) servers.push(invite);
      setSetting(gid, 'verify_join_servers', servers);
      return interaction.editReply({ embeds: [Embed.success('Verification Step Added', `Members must now join these server(s) to verify:\n${servers.map(s => `• ${s}`).join('\n')}\n\nIf Loopy is also in that server, membership is checked automatically; otherwise members confirm with a button.`)] });
    }
    if (sub === 'verifyjoinclear') {
      setSetting(gid, 'verify_join_servers', []);
      return interaction.editReply({ embeds: [Embed.success('Verification Step Removed', 'Members are no longer required to join other servers to verify.')] });
    }

    const keyMap = {
      log: ['log_channel', interaction.options.getChannel('channel')],
      welcome: ['welcome_channel', interaction.options.getChannel('channel')],
      muterole: ['mute_role', interaction.options.getRole('role')],
      autorole: ['auto_role', interaction.options.getRole('role')],
      levelupchannel: ['levelup_channel', interaction.options.getChannel('channel')],
      welcomemessage: ['welcome_message', { name: interaction.options.getString('message') }],
      verifiedrole: ['verified_role', interaction.options.getRole('role')],
      ranklogchannel: ['rank_log_channel', interaction.options.getChannel('channel')],
      verifylogchannel: ['verify_log_channel', interaction.options.getChannel('channel')],
    };

    const [key, val] = keyMap[sub];
    setSetting(gid, key, val?.id || val?.name);

    const displayName = sub === 'welcomemessage' ? `\`${val.name}\`` : `${val}`;
    await interaction.editReply({ embeds: [Embed.success('Setting Updated', `**${sub}** has been set to ${displayName}`)] });
  },
};
