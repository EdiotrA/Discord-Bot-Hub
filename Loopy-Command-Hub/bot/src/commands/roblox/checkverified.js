const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const Roblox = require('../../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder().setName('checkverified').setDescription('Check if a user is verified')
    .addUserOption(o => o.setName('user').setDescription('User to check (default: yourself)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user') || interaction.user;
    const v = db.prepare('SELECT * FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(interaction.guildId, target.id);
    if (!v) return interaction.editReply({ embeds: [Embed.warning('Not Verified', `${target.tag} is not verified.`)] });
    const thumbnail = await Roblox.getUserThumbnail(v.roblox_user_id);
    await interaction.editReply({ embeds: [Embed.roblox('Verified User', `**${target.tag}** is verified as **${v.roblox_username}**`, [
      { name: 'Roblox Username', value: v.roblox_username, inline: true },
      { name: 'Roblox ID', value: v.roblox_user_id, inline: true },
      { name: 'Verified', value: `<t:${v.verified_at}:R>`, inline: true },
      { name: 'Profile', value: `[View](https://www.roblox.com/users/${v.roblox_user_id}/profile)`, inline: true },
    ], thumbnail)] });
  },
};
