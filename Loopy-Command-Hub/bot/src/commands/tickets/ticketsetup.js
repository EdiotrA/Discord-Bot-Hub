const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Embed = require('../../utils/embed');
const { db, getSetting, setSetting } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('ticketsetup').setDescription('Configure the ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('addcategory').setDescription('Add a ticket category')
      .addStringOption(o => o.setName('name').setDescription('Internal name (no spaces)').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Display label').setRequired(true))
      .addRoleOption(o => o.setName('supportrole').setDescription('Support role (optional: auto-detect helpers) ').setRequired(false))
      .addRoleOption(o => o.setName('supportrole2').setDescription('Additional support role').setRequired(false))
      .addRoleOption(o => o.setName('supportrole3').setDescription('Additional support role').setRequired(false))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji for the category').setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Category description').setRequired(false))
      .addChannelOption(o => o.setName('logchannel').setDescription('Log channel for this category').setRequired(false).addChannelTypes(ChannelType.GuildText))
      .addIntegerOption(o => o.setName('timeout').setDescription('Auto-close after X minutes of inactivity (default 1440)').setRequired(false))
      .addIntegerOption(o => o.setName('maxopen').setDescription('Max open tickets per user (default 1)').setRequired(false)))
    .addSubcommand(s => s.setName('removecategory').setDescription('Remove a ticket category')
      .addStringOption(o => o.setName('name').setDescription('Category name').setRequired(true)))
    .addSubcommand(s => s.setName('listcategories').setDescription('List all ticket categories'))
    .addSubcommand(s => s.setName('logchannel').setDescription('Set global ticket log channel')
      .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true).addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(s => s.setName('timeout').setDescription('Set auto-close timeout for a category')
      .addStringOption(o => o.setName('category').setDescription('Category name').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Minutes until auto-close').setRequired(true)))
    .addSubcommand(s => s.setName('autoclose').setDescription('Toggle auto-close for a category')
      .addStringOption(o => o.setName('category').setDescription('Category name').setRequired(true))
      .addBooleanOption(o => o.setName('enabled').setDescription('Enable or disable').setRequired(true)))
    .addSubcommand(s => s.setName('ai').setDescription('Configure natural-language AI replies for a category')
      .addStringOption(o => o.setName('category').setDescription('Optional legacy category scope; leave blank for the whole ticket panel').setRequired(false))
      .addBooleanOption(o => o.setName('enabled').setDescription('Let Loopy reply in tickets in this category').setRequired(true))
      .addStringOption(o => o.setName('instructions').setDescription('What Loopy should do and how it should respond').setRequired(false).setMaxLength(1000))),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === 'addcategory') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const label = interaction.options.getString('label');
      const roles = ['supportrole', 'supportrole2', 'supportrole3'].map(key => interaction.options.getRole(key)).filter(Boolean);
      const emoji = interaction.options.getString('emoji') || '🎫';
      const desc = interaction.options.getString('description') || '';
      const logCh = interaction.options.getChannel('logchannel');
      const timeout = interaction.options.getInteger('timeout') || 1440;
      const maxOpen = interaction.options.getInteger('maxopen') || 1;
      db.prepare('INSERT OR REPLACE INTO ticket_categories (guild_id, name, label, emoji, description, support_role_ids, log_channel_id, timeout_minutes, max_open) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(gid, name, label, emoji, desc, JSON.stringify(roles.map(role => role.id)), logCh?.id || null, timeout, maxOpen);
      return interaction.editReply({ embeds: [Embed.success('Category Created', `**${emoji} ${label}** (\`${name}\`) added.\nSupport: ${roles.length ? roles.join(', ') : 'Auto-detect helper/support roles when a ticket opens'} | Timeout: ${timeout}m | Max open: ${maxOpen}`)] });
    }
    if (sub === 'removecategory') {
      db.prepare('DELETE FROM ticket_categories WHERE guild_id = ? AND name = ?').run(gid, interaction.options.getString('name'));
      return interaction.editReply({ embeds: [Embed.success('Category Removed', 'Ticket category deleted.')] });
    }
    if (sub === 'listcategories') {
      const cats = db.prepare('SELECT * FROM ticket_categories WHERE guild_id = ?').all(gid);
      if (!cats.length) return interaction.editReply({ embeds: [Embed.info('Ticket Categories', 'No categories configured. Use `/ticketsetup addcategory`.')] });
      const desc = cats.map(c => `${c.emoji} **${c.label}** (\`${c.name}\`)\nSupport: ${JSON.parse(c.support_role_ids).map(id => `<@&${id}>`).join(', ')} | Timeout: ${c.timeout_minutes}m | Auto-close: ${c.auto_close_enabled ? '✅' : '❌'}`).join('\n\n');
      return interaction.editReply({ embeds: [Embed.info('Ticket Categories', desc)] });
    }
    if (sub === 'logchannel') {
      setSetting(gid, 'ticket_log_channel', interaction.options.getChannel('channel').id);
      return interaction.editReply({ embeds: [Embed.success('Log Channel Set', `Ticket logs will go to ${interaction.options.getChannel('channel')}.`)] });
    }
    if (sub === 'timeout') {
      db.prepare('UPDATE ticket_categories SET timeout_minutes = ? WHERE guild_id = ? AND name = ?').run(interaction.options.getInteger('minutes'), gid, interaction.options.getString('category'));
      return interaction.editReply({ embeds: [Embed.success('Timeout Updated', `Auto-close set to **${interaction.options.getInteger('minutes')} minutes**.`)] });
    }
    if (sub === 'autoclose') {
      db.prepare('UPDATE ticket_categories SET auto_close_enabled = ? WHERE guild_id = ? AND name = ?').run(interaction.options.getBoolean('enabled') ? 1 : 0, gid, interaction.options.getString('category'));
      return interaction.editReply({ embeds: [Embed.success('Auto-Close Updated', `Auto-close is now **${interaction.options.getBoolean('enabled') ? 'enabled' : 'disabled'}**.`)] });
    }
    if (sub === 'ai') {
      const enabled = interaction.options.getBoolean('enabled');
      const instructions = interaction.options.getString('instructions') || '';
      const category = interaction.options.getString('category')?.toLowerCase();
      if (category) {
        const result = db.prepare('UPDATE ticket_categories SET ai_enabled = ?, ai_instructions = ? WHERE guild_id = ? AND name = ?')
          .run(enabled ? 1 : 0, instructions, gid, category);
        if (!result.changes) return interaction.editReply({ embeds: [Embed.error('Category Not Found', `No ticket category named \`${category}\` exists.`)] });
      } else {
        setSetting(gid, 'ticket_ai_enabled', enabled);
        setSetting(gid, 'ticket_ai_instructions', instructions);
        db.prepare('UPDATE ticket_categories SET ai_enabled = ?, ai_instructions = ? WHERE guild_id = ?').run(enabled ? 1 : 0, instructions, gid);
      }
      return interaction.editReply({ embeds: [Embed.success('Ticket Panel AI Updated', `Loopy replies are now **${enabled ? 'enabled' : 'disabled'}** across the ticket panel.${enabled ? `\n**Instructions:** ${instructions || 'Use helpful support behavior.'}` : '\nLoopy will stay silent until enabled again.'}`)] });
    }
  },
};
