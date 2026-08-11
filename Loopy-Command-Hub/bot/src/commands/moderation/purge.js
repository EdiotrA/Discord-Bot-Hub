const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Embed = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder().setName('purge').setDescription('Bulk delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger('amount');
    const user = interaction.options.getUser('user');
    let messages = await interaction.channel.messages.fetch({ limit: 100 });
    if (user) messages = messages.filter(m => m.author.id === user.id);
    messages = [...messages.values()].slice(0, amount);
    const deleted = await interaction.channel.bulkDelete(messages, true).catch(err => { return { size: 0 }; });
    await interaction.editReply({ embeds: [Embed.success('Messages Purged', `Deleted **${deleted.size}** messages${user ? ` from ${user.tag}` : ''}.`)] });
  },
};
