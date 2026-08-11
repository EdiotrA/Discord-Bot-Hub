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
      .addChannelOption(o => o.setName('channel').setDescription('Rank log channel').setRequired(true).addChannelTypes(ChannelType.GuildText))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    const keyMap = {
      log: ['log_channel', interaction.options.getChannel('channel')],
      welcome: ['welcome_channel', interaction.options.getChannel('channel')],
      muterole: ['mute_role', interaction.options.getRole('role')],
      autorole: ['auto_role', interaction.options.getRole('role')],
      levelupchannel: ['levelup_channel', interaction.options.getChannel('channel')],
      welcomemessage: ['welcome_message', { name: interaction.options.getString('message') }],
      verifiedrole: ['verified_role', interaction.options.getRole('role')],
      ranklogchannel: ['rank_log_channel', interaction.options.getChannel('channel')],
    };

    const [key, val] = keyMap[sub];
    setSetting(gid, key, val?.id || val?.name);

    const displayName = sub === 'welcomemessage' ? `\`${val.name}\`` : `${val}`;
    await interaction.editReply({ embeds: [Embed.success('Setting Updated', `**${sub}** has been set to ${displayName}`)] });
  },
};
