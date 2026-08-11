const { db } = require('../database');
const Embed = require('../utils/embed');

module.exports = {
  name: 'messageReactionAdd',
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }

    const { message } = reaction;
    if (!message.guild) return;

    const guildId = message.guild.id;
    const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

    // Look up reaction role
    const row = db.prepare('SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').get(guildId, message.id, emoji);

    if (!row) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const role = message.guild.roles.cache.get(row.role_id);
    if (!role) return;

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await user.send({ embeds: [Embed.info('Role Removed', `The **${role.name}** role has been removed in **${message.guild.name}**.`)] }).catch(() => {});
      } else {
        await member.roles.add(role);
        await user.send({ embeds: [Embed.success('Role Added', `You've been given the **${role.name}** role in **${message.guild.name}**.`)] }).catch(() => {});
      }
    } catch (err) {
      console.error('[ReactionRole]', err.message);
    }
  },
};
