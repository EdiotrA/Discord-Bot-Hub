const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

const categories = {
  Admin: {
    emoji: '⚙️',
    description: 'Server administration and configuration',
    commands: [
      { name: 'setup', description: 'Initial bot setup wizard' },
      { name: 'prefix', description: 'Set command prefix' },
      { name: 'setlogchannel', description: 'Set the moderation log channel' },
      { name: 'setlevelupchannel', description: 'Set where level-up messages appear' },
      { name: 'toggleexp', description: 'Enable or disable the EXP system' },
      { name: 'setautorole', description: 'Set auto-role for new members' },
      { name: 'commandperm', description: 'Manage command permissions' },
      { name: 'antilink', description: 'Configure anti-link protection' },
      { name: 'antiscam', description: 'Configure anti-scam protection' },
    ],
  },
  Moderation: {
    emoji: '🔨',
    description: 'Moderation tools to keep your server safe',
    commands: [
      { name: 'ban', description: 'Ban a member from the server' },
      { name: 'unban', description: 'Unban a user from the server' },
      { name: 'kick', description: 'Kick a member from the server' },
      { name: 'mute', description: 'Timeout/mute a member' },
      { name: 'unmute', description: 'Remove a timeout from a member' },
      { name: 'warn', description: 'Issue a warning to a member' },
      { name: 'warnings', description: 'View warnings for a user' },
      { name: 'clearwarnings', description: 'Clear warnings for a user' },
      { name: 'purge', description: 'Bulk delete messages' },
      { name: 'slowmode', description: 'Set channel slowmode' },
      { name: 'lock', description: 'Lock a channel' },
      { name: 'unlock', description: 'Unlock a channel' },
      { name: 'modlogs', description: 'View moderation logs' },
    ],
  },
  Tickets: {
    emoji: '🎫',
    description: 'Ticket system for support and inquiries',
    commands: [
      { name: 'ticket', description: 'Open a support ticket' },
      { name: 'close', description: 'Close a ticket' },
      { name: 'adduser', description: 'Add a user to a ticket' },
      { name: 'removeuser', description: 'Remove a user from a ticket' },
      { name: 'ticketsetup', description: 'Configure the ticket system' },
    ],
  },
  Applications: {
    emoji: '📋',
    description: 'Application system for server roles and positions',
    commands: [
      { name: 'apply', description: 'Submit an application' },
      { name: 'applications', description: 'View pending applications' },
      { name: 'appsetup', description: 'Configure the application system' },
    ],
  },
  Roblox: {
    emoji: '🟥',
    description: 'Roblox integration and verification commands',
    commands: [
      { name: 'verify', description: 'Verify your Roblox account' },
      { name: 'robloxinfo', description: 'Look up a Roblox user' },
      { name: 'groupinfo', description: 'View Roblox group information' },
      { name: 'rankbind', description: 'Bind a Roblox rank to a Discord role' },
      { name: 'syncranks', description: 'Sync your Roblox group ranks' },
    ],
  },
  Fun: {
    emoji: '🎮',
    description: 'Fun and entertainment commands',
    commands: [
      { name: '8ball', description: 'Ask the magic 8-ball a question' },
      { name: 'coinflip', description: 'Flip a coin' },
      { name: 'dice', description: 'Roll dice' },
      { name: 'meme', description: 'Get a random meme' },
      { name: 'joke', description: 'Get a random joke' },
      { name: 'roast', description: 'Roast someone (AI-powered)' },
      { name: 'compliment', description: 'Compliment someone (AI-powered)' },
      { name: 'trivia', description: 'Play a trivia game' },
      { name: 'tictactoe', description: 'Play Tic Tac Toe' },
      { name: 'rps', description: 'Play Rock Paper Scissors' },
    ],
  },
  Music: {
    emoji: '🎵',
    description: 'Music playback commands',
    commands: [
      { name: 'play', description: 'Play a song or playlist' },
      { name: 'skip', description: 'Skip the current song' },
      { name: 'stop', description: 'Stop music and clear queue' },
      { name: 'pause', description: 'Pause playback' },
      { name: 'resume', description: 'Resume playback' },
      { name: 'queue', description: 'View the music queue' },
      { name: 'volume', description: 'Set playback volume' },
      { name: 'nowplaying', description: 'Show currently playing song' },
    ],
  },
  EXP: {
    emoji: '📈',
    description: 'EXP and leveling system commands',
    commands: [
      { name: 'level', description: 'View your level and EXP progress' },
      { name: 'leaderboard', description: 'View the server EXP leaderboard' },
      { name: 'addexp', description: 'Add EXP to a user [Admin]' },
      { name: 'removeexp', description: 'Remove EXP from a user [Admin]' },
      { name: 'resetexp', description: 'Reset user or server EXP [Admin]' },
      { name: 'setlevelrole', description: 'Set a role reward for a level [Admin]' },
      { name: 'removelevelrole', description: 'Remove a level role reward [Admin]' },
      { name: 'levelroles', description: 'View all level role rewards' },
    ],
  },
  Utility: {
    emoji: '🔧',
    description: 'Useful utility and information commands',
    commands: [
      { name: 'help', description: 'Show this help menu' },
      { name: 'ping', description: 'Check bot latency' },
      { name: 'botinfo', description: 'View bot information' },
      { name: 'serverinfo', description: 'View server information' },
      { name: 'userinfo', description: 'View user information' },
      { name: 'avatar', description: 'View a user\'s avatar' },
      { name: 'banner', description: 'View a user\'s profile banner' },
      { name: 'roleinfo', description: 'View role information' },
      { name: 'channelinfo', description: 'View channel information' },
      { name: 'invite', description: 'Get the bot invite link' },
      { name: 'uptime', description: 'View bot uptime' },
      { name: 'calculate', description: 'Calculate a math expression' },
      { name: 'color', description: 'View color information' },
      { name: 'base64', description: 'Encode or decode base64' },
      { name: 'remind', description: 'Set a reminder' },
      { name: 'afk', description: 'Set your AFK status' },
      { name: 'translate', description: 'Translate text using AI' },
      { name: 'define', description: 'Look up a word definition' },
      { name: 'weather', description: 'Check the weather' },
      { name: 'steal', description: 'Steal an emoji to your server' },
      { name: 'servericon', description: 'View the server icon' },
      { name: 'serverbanner', description: 'View the server banner' },
      { name: 'membercount', description: 'View member statistics' },
      { name: 'firstmessage', description: 'Jump to first message in a channel' },
      { name: 'timestamp', description: 'Convert a date to Discord timestamp' },
      { name: 'charcount', description: 'Count characters, words and lines' },
      { name: 'randomuser', description: 'Pick a random server member' },
      { name: 'snipe', description: 'Show last deleted message' },
      { name: 'editsnipe', description: 'Show last edited message' },
      { name: 'ship', description: 'Ship two users together' },
      { name: 'iq', description: 'Get a fake IQ score' },
      { name: 'rankcard', description: 'View your rank card' },
      { name: 'mypermissions', description: 'View your channel permissions' },
      { name: 'inrole', description: 'View members with a specific role' },
      { name: 'say', description: 'Make the bot say something' },
      { name: 'sendembed', description: 'Send a custom embed' },
      { name: 'poll', description: 'Create a poll' },
      { name: 'boop', description: 'Boop someone' },
      { name: 'hug', description: 'Hug someone' },
      { name: 'highfive', description: 'High five someone' },
    ],
  },
  Protection: {
    emoji: '🛡️',
    description: 'Anti-raid and protection features',
    commands: [
      { name: 'pingprotect', description: 'Configure ping protection' },
      { name: 'pingstop', description: 'Protect users or roles from unauthorized pings' },
      { name: 'antiraid', description: 'Configure anti-raid settings' },
    ],
  },
  LOA: {
    emoji: '🏖️',
    description: 'Leave of Absence management',
    commands: [
      { name: 'loa', description: 'Submit a leave of absence request' },
      { name: 'loalist', description: 'View active LOA requests' },
      { name: 'loaapprove', description: 'Approve an LOA request [Admin]' },
      { name: 'loadeny', description: 'Deny an LOA request [Admin]' },
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View all commands and how to use them')
    .addStringOption(opt =>
      opt.setName('command').setDescription('Get detailed info on a specific command').setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('View commands in a specific category')
        .setRequired(false)
        .addChoices(
          { name: 'Admin', value: 'Admin' },
          { name: 'Moderation', value: 'Moderation' },
          { name: 'Tickets', value: 'Tickets' },
          { name: 'Applications', value: 'Applications' },
          { name: 'Roblox', value: 'Roblox' },
          { name: 'Fun', value: 'Fun' },
          { name: 'Music', value: 'Music' },
          { name: 'EXP', value: 'EXP' },
          { name: 'Utility', value: 'Utility' },
          { name: 'Protection', value: 'Protection' },
          { name: 'LOA', value: 'LOA' }
        )
    ),

  async execute(interaction) {
    const commandName = interaction.options.getString('command');
    const categoryName = interaction.options.getString('category');

    // Specific command info
    if (commandName) {
      const cmd = interaction.client.commands.get(commandName.toLowerCase());
      if (!cmd) {
        return interaction.reply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.error)
            .setTitle('❌ Command Not Found')
            .setDescription(`No command named \`/${commandName}\` was found.\nUse \`/help\` to see all available commands.`)
            .setTimestamp()],
          ephemeral: true,
        });
      }

      const data = cmd.data;
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📖 Command: /${data.name}`)
        .setDescription(data.description || 'No description provided.')
        .setFooter({ text: 'Use /help [category] to browse commands by category' })
        .setTimestamp();

      // Show options/args
      if (data.options && data.options.length > 0) {
        const args = data.options.map(o => {
          const req = o.required ? '*(required)*' : '*(optional)*';
          return `\`${o.name}\` ${req} — ${o.description}`;
        }).join('\n');
        embed.addFields({ name: '📝 Arguments', value: args });
      }

      return interaction.reply({ embeds: [embed] });
    }

    // Category filter
    if (categoryName) {
      const cat = categories[categoryName];
      if (!cat) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(config.colors.error).setTitle('❌ Category Not Found').setDescription(`Unknown category: \`${categoryName}\``).setTimestamp()], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`${cat.emoji} ${categoryName} Commands`)
        .setDescription(`${cat.description}\n\n${cat.commands.map(c => `\`/${c.name}\` — ${c.description}`).join('\n')}`)
        .setFooter({ text: `${cat.commands.length} commands • Use /help [command] for details` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // Full help overview
    const totalCommands = Object.values(categories).reduce((sum, cat) => sum + cat.commands.length, 0);
    const categoryLines = Object.entries(categories).map(([name, cat]) =>
      `${cat.emoji} **${name}** (${cat.commands.length}) — ${cat.description}`
    );

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('📚 Loopy Bot — Command Help')
      .setDescription(
        `Welcome to **Loopy**! Here's an overview of all command categories.\n` +
        `Use \`/help category:[name]\` to see commands in a category.\n` +
        `Use \`/help command:[name]\` for info on a specific command.\n\n` +
        categoryLines.join('\n')
      )
      .addFields(
        { name: '📊 Statistics', value: `**${totalCommands}+** commands across **${Object.keys(categories).length}** categories`, inline: true },
        { name: '🔗 Support', value: `[Support Server](${config.supportServer})`, inline: true }
      )
      .setFooter({ text: `Loopy v${config.version} • Use /help [category] to explore` })
      .setThumbnail(interaction.client.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
