const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const config = require('../../config');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('add').setDescription('Add a reaction role to a message')
      .addStringOption(o => o.setName('messageid').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Channel containing the message').setRequired(false)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a reaction role')
      .addStringOption(o => o.setName('messageid').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all reaction roles'))
    .addSubcommand(s => s.setName('panel').setDescription('Create a reaction role panel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel to post in').setRequired(true))
      .addStringOption(o => o.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(false))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === 'add') {
      const msgId = interaction.options.getString('messageid');
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');
      const ch = interaction.options.getChannel('channel') || interaction.channel;
      try {
        const msg = await ch.messages.fetch(msgId);
        await msg.react(emoji);
        db.prepare('INSERT OR REPLACE INTO reaction_roles (guild_id, channel_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?, ?)').run(gid, ch.id, msgId, emoji, role.id);
        return interaction.editReply({ embeds: [Embed.success('Reaction Role Added',
          `> **Emoji:** ${emoji}\n> **Role:** ${role}\n> **Message:** [Jump to message](${msg.url})\n\nReacting with ${emoji} will now grant ${role}.`)] });
      } catch (err) {
        return interaction.editReply({ embeds: [Embed.error('Error', `Could not add reaction role: ${err.message}`)] });
      }
    }
    if (sub === 'remove') {
      const msgId = interaction.options.getString('messageid');
      const emoji = interaction.options.getString('emoji');
      db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').run(gid, msgId, emoji);
      return interaction.editReply({ embeds: [Embed.success('Removed', 'Reaction role removed.')] });
    }
    if (sub === 'list') {
      const rows = db.prepare('SELECT * FROM reaction_roles WHERE guild_id = ?').all(gid);
      if (!rows.length) return interaction.editReply({ embeds: [Embed.info('Reaction Roles', 'No reaction roles set up yet.\nUse `/reactionrole add` to create one.')] });
      const desc = rows.map(r => `> ${r.emoji} → <@&${r.role_id}> · Message \`${r.message_id}\``).join('\n');
      return interaction.editReply({ embeds: [Embed.info('Reaction Roles', desc)] });
    }
    if (sub === 'panel') {
      const ch = interaction.options.getChannel('channel');
      const title = interaction.options.getString('title');
      const desc = interaction.options.getString('description') || 'React to a message below to receive a role!';
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(title)
        .setDescription(desc)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .setFooter(Embed.brandFooter('React below to get or remove a role'))
        .setTimestamp();
      const msg = await ch.send({ embeds: [embed] });
      return interaction.editReply({ embeds: [Embed.success('Panel Created',
        `> **Channel:** ${ch}\n> **Message ID:** \`${msg.id}\`\n\nUse \`/reactionrole add\` with that message ID to attach reaction roles.`)] });
    }
  },
};
