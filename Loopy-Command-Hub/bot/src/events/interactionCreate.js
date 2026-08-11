const { InteractionType } = require('discord.js');
const Embed = require('../utils/embed');
const { checkPermission } = require('../utils/permissions');
const { db } = require('../database');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      const focused = interaction.options.getFocused().toLowerCase();
      const choices = [...interaction.client.commands.keys()]
        .filter(name => name.includes(focused))
        .sort()
        .slice(0, 25)
        .map(name => ({ name: `/${name}`, value: name }));
      return interaction.respond(choices).catch(() => {});
    }

    // ── Slash Commands ─────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      // Permission check
      if (interaction.guild) {
        const allowed = await checkPermission(interaction, interaction.commandName);
        if (!allowed) {
          return interaction.reply({
            embeds: [Embed.error('Permission Denied', 'You do not have permission to use this command.\n\nAsk a server admin to grant you access using `/permission grantall`, `/addpermission`, or `/setpermissions`.')],
            ephemeral: true,
          });
        }
      }

      try {
        await command.execute(interaction);

        // Update ticket last_activity
        if (interaction.channel) {
          db.prepare('UPDATE tickets SET last_activity = ? WHERE channel_id = ? AND status = ?')
            .run(Math.floor(Date.now() / 1000), interaction.channelId, 'open');
        }
      } catch (err) {
        console.error(`[Command Error] ${interaction.commandName}:`, err);
        const errEmbed = Embed.error('Command Error', `An unexpected error occurred.\n\`\`\`${err.message.slice(0, 500)}\`\`\``);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ embeds: [errEmbed] }).catch(() => {});
        } else {
          await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
        }
      }
      return;
    }

    // ── Button Interactions ────────────────────────────────────────────────
    if (interaction.isButton()) {
      const [action, ...args] = interaction.customId.split(':');

      // Ticket open button
      if (action === 'ticket_open') {
        const { handleTicketOpen } = require('../commands/tickets/ticket-panel');
        return handleTicketOpen(interaction, args[0]);
      }

      // Ticket close button
      if (action === 'ticket_close') {
        const { handleTicketClose } = require('../commands/tickets/close');
        return handleTicketClose(interaction);
      }

      // Ticket claim button
      if (action === 'ticket_claim') {
        const { handleTicketClaim } = require('../commands/tickets/claim');
        return handleTicketClaim(interaction);
      }

      // Application accept/deny buttons
      if (action === 'app_accept') {
        const { handleAppAccept } = require('../commands/applications/accept');
        return handleAppAccept(interaction, args[0]);
      }
      if (action === 'app_deny') {
        const { handleAppDeny } = require('../commands/applications/deny');
        return handleAppDeny(interaction, args[0]);
      }

      // LOA accept/deny buttons
      if (action === 'loa_accept') {
        const { handleLoaAccept } = require('../commands/loa/acceptloa');
        return handleLoaAccept(interaction, args[0]);
      }
      if (action === 'loa_deny') {
        const { handleLoaDeny } = require('../commands/loa/denyloa');
        return handleLoaDeny(interaction, args[0]);
      }

      // Rank request accept/deny buttons
      if (action === 'rank_accept') {
        const { handleRankAccept } = require('../commands/roblox/acceptrank');
        return handleRankAccept(interaction, args[0]);
      }
      if (action === 'rank_deny') {
        const { handleRankDeny } = require('../commands/roblox/denyrank');
        return handleRankDeny(interaction, args[0]);
      }

      // Game buttons
      if (action === 'game_ttt' || action === 'game_c4' || action === 'game_rps') {
        const { handleGameButton } = require('../commands/fun/games');
        return handleGameButton(interaction);
      }
    }

    // ── Select Menu ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      const [action, ...args] = interaction.customId.split(':');
      if (action === 'ticket_category') {
        const { handleCategorySelect } = require('../commands/tickets/ticket-panel');
        return handleCategorySelect(interaction);
      }
    }

    // ── Modal Submit ───────────────────────────────────────────────────────
    if (interaction.type === InteractionType.ModalSubmit) {
      const [action, ...args] = interaction.customId.split(':');

      if (action === 'apply_modal') {
        const { handleApplyModal } = require('../commands/applications/apply');
        return handleApplyModal(interaction, args[0]);
      }

      if (action === 'ticket_modal') {
        const { handleTicketModal } = require('../commands/tickets/ticket-panel');
        return handleTicketModal(interaction, args[0]);
      }

      if (action === 'verify_modal') {
        const { handleVerifyModal } = require('../commands/roblox/verify');
        return handleVerifyModal(interaction);
      }

      if (action === 'loa_modal') {
        const { handleLoaModal } = require('../commands/loa/loa');
        return handleLoaModal(interaction);
      }

      if (action === 'rank_modal') {
        const { handleRankModal } = require('../commands/roblox/rankrequest');
        return handleRankModal(interaction);
      }
    }
  },
};
