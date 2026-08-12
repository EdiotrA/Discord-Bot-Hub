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

      if (interaction.customId === 'verify_start') {
        const { buildVerifyModal } = require('../commands/roblox/verify');
        return interaction.showModal(buildVerifyModal());
      }

      if (action === 'hub') {
        if (args[0] === 'verify') {
          const { buildVerifyModal } = require('../commands/roblox/verify');
          return interaction.showModal(buildVerifyModal());
        }
        if (args[0] === 'ticket') {
          const { handleTicketOpen } = require('../commands/tickets/ticket-panel');
          return handleTicketOpen(interaction, 'general');
        }
        if (args[0] === 'assistant') {
          const { buildAssistantModal } = require('../commands/utility/assistant');
          return interaction.showModal(buildAssistantModal());
        }
        if (args[0] === 'economy') {
          return interaction.reply({
            embeds: [Embed.game('Economy Hub', 'Choose an action below. Daily gives a free reward, and Coin Bet uses a 25-coin quick wager.')],
            components: [new (require('discord.js').ActionRowBuilder)().addComponents(
              new (require('discord.js').ButtonBuilder)().setCustomId('economy:daily').setLabel('Claim Daily').setStyle(require('discord.js').ButtonStyle.Success),
              new (require('discord.js').ButtonBuilder)().setCustomId('economy:coinflip').setLabel('Quick Coin Bet').setStyle(require('discord.js').ButtonStyle.Primary),
            )],
            ephemeral: true,
          });
        }
        if (args[0] === 'mog') {
          return interaction.reply({
            embeds: [Embed.game('Mog Hub', 'Browse your Mog profile, the leaderboard, or the shop.')],
            components: [new (require('discord.js').ActionRowBuilder)().addComponents(
              new (require('discord.js').ButtonBuilder)().setCustomId('mog:profile').setLabel('My Profile').setStyle(require('discord.js').ButtonStyle.Primary),
              new (require('discord.js').ButtonBuilder)().setCustomId('mog:leaderboard').setLabel('Leaderboard').setStyle(require('discord.js').ButtonStyle.Secondary),
              new (require('discord.js').ButtonBuilder)().setCustomId('mog:shop').setLabel('Shop').setStyle(require('discord.js').ButtonStyle.Secondary),
            )],
            ephemeral: true,
          });
        }
      }

      if (action === 'economy') {
        const Economy = require('../utils/economy');
        if (args[0] === 'daily') {
          const result = Economy.claimDaily(interaction.guildId, interaction.user.id);
          if (!result.claimed) return interaction.reply({ embeds: [Embed.warning('Already Claimed', `Come back in **${Economy.formatTime(result.remaining)}**.`)], ephemeral: true });
          return interaction.reply({ embeds: [Embed.success('Daily Claimed', `You received **${result.amount.toLocaleString()}** coins.`)], ephemeral: true });
        }
        if (args[0] === 'coinflip') {
          const wager = 25;
          const account = Economy.getBalance(interaction.guildId, interaction.user.id);
          if (account.wallet < wager) return interaction.reply({ embeds: [Embed.error('Not Enough Coins', 'You need 25 wallet coins for the quick bet.')], ephemeral: true });
          const result = Math.random() < 0.5 ? 'heads' : 'tails';
          const won = result === 'heads';
          Economy.changeWallet(interaction.guildId, interaction.user.id, won ? wager : -wager);
          return interaction.reply({ embeds: [Embed.game('Quick Coin Bet', `The coin landed on **${result}**.\n${won ? 'You won 25 coins.' : 'You lost 25 coins.'}`)], ephemeral: true });
        }
      }

      if (action === 'mog') {
        const Mog = require('../utils/mog');
        if (args[0] === 'profile') {
          const profile = Mog.ensureProfile(interaction.guildId, interaction.user.id);
          return interaction.reply({ embeds: [Embed.game('Mog Profile', `${interaction.user}\n\n**Mog Points:** ${profile.points}\n**Wins:** ${profile.wins} • **Losses:** ${profile.losses}\n**Pet:** \`${profile.pet}\`\n**Aura:** \`${profile.aura}\`\n**Power:** \`${profile.power}\``)], ephemeral: true });
        }
        if (args[0] === 'leaderboard') {
          const rows = Mog.leaderboard(interaction.guildId);
          return interaction.reply({ embeds: [Embed.leaderboard('Mog Leaderboard', rows.length ? rows.map((r, i) => `**${i + 1}.** <@${r.user_id}> — **${r.points}** points`).join('\n') : 'No Mog matches yet.', [])], ephemeral: true });
        }
        if (args[0] === 'shop') {
          return interaction.reply({ embeds: [Embed.info('Mog Shop', Mog.shopLines().join('\n'))], ephemeral: true });
        }
      }

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

      // Poll vote buttons
      if (action === 'poll_vote') {
        const { handlePollVote } = require('../commands/fun/poll');
        return handlePollVote(interaction, args[0]);
      }

      // Giveaway buttons
      if (action === 'gw_enter' || action === 'gw_entries') {
        const { handleGiveawayButton } = require('../commands/fun/giveaway');
        return handleGiveawayButton(interaction, action);
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

      if (action === 'assistant_modal') {
        const { handleAssistantModal } = require('../commands/utility/assistant');
        return handleAssistantModal(interaction);
      }
    }
  },
};
