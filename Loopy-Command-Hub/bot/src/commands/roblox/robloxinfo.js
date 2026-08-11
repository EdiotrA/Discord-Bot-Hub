const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');
const Roblox = require('../../utils/roblox');

module.exports = {
  data: new SlashCommandBuilder().setName('robloxinfo').setDescription('Get Roblox profile info')
    .addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(false))
    .addUserOption(o => o.setName('user').setDescription('Discord user (if verified)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply();
    const discordUser = interaction.options.getUser('user');
    let username = interaction.options.getString('username');
    if (!username && discordUser) {
      const v = db.prepare('SELECT roblox_username FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(interaction.guildId, discordUser.id);
      if (!v) return interaction.editReply({ embeds: [Embed.error('Not Verified', `${discordUser.tag} is not verified.`)] });
      username = v.roblox_username;
    }
    if (!username) {
      const v = db.prepare('SELECT roblox_username FROM verifications WHERE guild_id = ? AND discord_user_id = ?').get(interaction.guildId, interaction.user.id);
      if (!v) return interaction.editReply({ embeds: [Embed.error('No Username', 'Provide a username or verify yourself with `/verify`.')] });
      username = v.roblox_username;
    }
    const profile = await Roblox.getFullProfile(username);
    if (!profile) return interaction.editReply({ embeds: [Embed.error('Not Found', `Could not find Roblox user \`${username}\`.`)] });
    await interaction.editReply({ embeds: [Embed.roblox(profile.displayName || profile.name, profile.description?.slice(0, 300) || 'No bio', [
      { name: 'Username', value: profile.name, inline: true },
      { name: 'User ID', value: String(profile.id), inline: true },
      { name: 'Created', value: `<t:${Math.floor(new Date(profile.created).getTime()/1000)}:R>`, inline: true },
      { name: 'Profile', value: `[View on Roblox](https://www.roblox.com/users/${profile.id}/profile)`, inline: true },
    ], profile.thumbnail)] });
  },
};
