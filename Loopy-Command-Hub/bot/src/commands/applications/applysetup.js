const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Embed = require('../../utils/embed');
const { db } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder().setName('applysetup').setDescription('Configure the application system')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('create').setDescription('Create an application type')
      .addStringOption(o => o.setName('name').setDescription('Internal name (no spaces)').setRequired(true))
      .addStringOption(o => o.setName('label').setDescription('Display name').setRequired(true))
      .addRoleOption(o => o.setName('reviewerrole').setDescription('Role that reviews applications').setRequired(true))
      .addChannelOption(o => o.setName('resultchannel').setDescription('Channel to post applications in').setRequired(true).addChannelTypes(ChannelType.GuildText))
      .addStringOption(o => o.setName('description').setDescription('Description').setRequired(false))
      .addStringOption(o => o.setName('questions').setDescription('Questions separated by | (e.g. Q1|Q2|Q3)').setRequired(false)))
    .addSubcommand(s => s.setName('delete').setDescription('Delete an application type')
      .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)))
    .addSubcommand(s => s.setName('open').setDescription('Open applications')
      .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)))
    .addSubcommand(s => s.setName('close').setDescription('Close applications')
      .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true)))
    .addSubcommand(s => s.setName('questions').setDescription('Set questions for an application type')
      .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true))
      .addStringOption(o => o.setName('questions').setDescription('Questions separated by | (e.g. Why do you want to join?|How old are you?)').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all application types')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === 'create') {
      const name = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
      const label = interaction.options.getString('label');
      const role = interaction.options.getRole('reviewerrole');
      const ch = interaction.options.getChannel('resultchannel');
      const desc = interaction.options.getString('description') || '';
      const qStr = interaction.options.getString('questions') || '';
      const questions = qStr ? qStr.split('|').map(q => q.trim()) : ['Why are you interested in joining?', 'Tell us about yourself.', 'Do you have any relevant experience?'];
      db.prepare('INSERT OR REPLACE INTO application_types (guild_id, name, label, description, questions, reviewer_role_ids, result_channel_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(gid, name, label, desc, JSON.stringify(questions), JSON.stringify([role.id]), ch.id);
      return interaction.editReply({ embeds: [Embed.success('Application Type Created', `**${label}** (\`${name}\`) created.\n**Questions:** ${questions.length}\n**Reviewer:** ${role}\n**Channel:** ${ch}`)] });
    }
    if (sub === 'delete') {
      db.prepare('DELETE FROM application_types WHERE guild_id = ? AND name = ?').run(gid, interaction.options.getString('name'));
      return interaction.editReply({ embeds: [Embed.success('Deleted', 'Application type removed.')] });
    }
    if (sub === 'open' || sub === 'close') {
      db.prepare('UPDATE application_types SET is_open = ? WHERE guild_id = ? AND name = ?').run(sub === 'open' ? 1 : 0, gid, interaction.options.getString('name'));
      return interaction.editReply({ embeds: [Embed.success(`Applications ${sub === 'open' ? 'Opened' : 'Closed'}`, `Applications for \`${interaction.options.getString('name')}\` are now ${sub === 'open' ? '🟢 open' : '🔴 closed'}.`)] });
    }
    if (sub === 'questions') {
      const questions = interaction.options.getString('questions').split('|').map(q => q.trim());
      db.prepare('UPDATE application_types SET questions = ? WHERE guild_id = ? AND name = ?').run(JSON.stringify(questions), gid, interaction.options.getString('name'));
      return interaction.editReply({ embeds: [Embed.success('Questions Updated', `Set ${questions.length} questions:\n${questions.map((q, i) => `${i+1}. ${q}`).join('\n')}`)] });
    }
    if (sub === 'list') {
      const types = db.prepare('SELECT * FROM application_types WHERE guild_id = ?').all(gid);
      if (!types.length) return interaction.editReply({ embeds: [Embed.info('Application Types', 'No application types created yet.')] });
      const desc = types.map(t => `**${t.label}** (\`${t.name}\`) — ${t.is_open ? '🟢 Open' : '🔴 Closed'} — ${JSON.parse(t.questions).length} questions`).join('\n');
      return interaction.editReply({ embeds: [Embed.info('Application Types', desc)] });
    }
  },
};
