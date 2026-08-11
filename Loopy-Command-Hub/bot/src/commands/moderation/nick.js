const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder().setName('nick').setDescription('Change or reset a member\'s nickname')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
    .addStringOption(o => o.setName('nickname').setDescription('New nickname (leave blank to reset)').setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const nick = interaction.options.getString('nickname');
    if (!target) return interaction.reply({ embeds: [Embed.error('Not Found', 'Member not found.')], ephemeral: true });
    await target.setNickname(nick || null);
    await interaction.reply({ embeds: [Embed.success('Nickname Updated', nick ? `${target} is now **${nick}**.` : `${target}'s nickname has been reset.`)], ephemeral: true });
  },
};
