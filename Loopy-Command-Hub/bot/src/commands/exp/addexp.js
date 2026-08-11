const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');
const ExpUtil = require('../../utils/exp');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addexp')
    .setDescription('Add EXP to a user [Admin Only]')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user').setDescription('The user to add EXP to').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Amount of EXP to add').setRequired(true).setMinValue(1).setMaxValue(1000000)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ embeds: [Embed.error('Permission Denied', 'You need Administrator permission to use this command.')], ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const guildId = interaction.guildId;

    const current = ExpUtil.getUser(guildId, target.id);
    const newExp = current.exp + amount;
    ExpUtil.setExp(guildId, target.id, newExp);

    const newLevel = ExpUtil.getLevel(newExp);

    await interaction.reply({
      embeds: [Embed.success(
        'EXP Added',
        `Added **${amount.toLocaleString()}** EXP to ${target}.`,
        [
          { name: 'New Total EXP', value: `${newExp.toLocaleString()}`, inline: true },
          { name: 'New Level', value: `${newLevel}`, inline: true },
        ]
      )],
    });
  },
};
