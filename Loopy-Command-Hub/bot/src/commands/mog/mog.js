const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Mog = require('../../utils/mog');
const config = require('../../config');

const TYPE_CHOICES = [
  { name: 'Pet',   value: 'pets'   },
  { name: 'Aura',  value: 'auras'  },
  { name: 'Power', value: 'powers' },
];

const SCOPE_CHOICES = [
  { name: 'This Server', value: 'server' },
  { name: 'Global',      value: 'global' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mog')
    .setDescription('Challenge members and manage your Mog profile')
    .addSubcommand(s => s
      .setName('challenge')
      .setDescription('Challenge another member to a Mog face-off')
      .addUserOption(o => o.setName('user').setDescription('Member to challenge').setRequired(true)))
    .addSubcommand(s => s
      .setName('profile')
      .setDescription('View a Mog profile')
      .addUserOption(o => o.setName('user').setDescription('Member to view (defaults to yourself)')))
    .addSubcommand(s => s
      .setName('leaderboard')
      .setDescription('View the Mog points leaderboard')
      .addStringOption(o => o.setName('scope').setDescription('Server or Global ranking').addChoices(...SCOPE_CHOICES)))
    .addSubcommand(s => s.setName('shop').setDescription('Browse pets, auras, and powers'))
    .addSubcommand(s => s.setName('inventory').setDescription('View your owned Mog items'))
    .addSubcommand(s => s
      .setName('buy')
      .setDescription('Purchase a Mog item')
      .addStringOption(o => o.setName('type').setDescription('Item category').setRequired(true).addChoices(...TYPE_CHOICES))
      .addStringOption(o => o.setName('item').setDescription('Item to buy').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('equip')
      .setDescription('Equip an owned Mog item')
      .addStringOption(o => o.setName('type').setDescription('Item category').setRequired(true).addChoices(...TYPE_CHOICES))
      .addStringOption(o => o.setName('item').setDescription('Item to equip').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const sub  = interaction.options.getSubcommand(false);
    const type = interaction.options.getString('type');
    if (!type) return interaction.respond([]);
    const ownedOnly = sub === 'equip';
    const choices = Mog.itemChoices(type, ownedOnly ? interaction.guildId : null, ownedOnly ? interaction.user.id : null);
    return interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction) {
    const gid = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    // ── Challenge ────────────────────────────────────────────────────────────
    if (sub === 'challenge') {
      const target = interaction.options.getUser('user');
      if (target.bot || target.id === interaction.user.id) {
        return interaction.reply({ embeds: [Embed.error('Invalid Target', 'Choose a different human member to challenge.')], ephemeral: true });
      }

      // Check rate limit before deferring so we can respond fast
      const limit = Mog.checkChallengeLimit(gid, interaction.user.id, target.id);
      if (!limit.allowed) {
        return interaction.reply({
          embeds: [Embed.warning(
            'Daily Challenge Limit Reached',
            `You have already challenged ${target} **${limit.used}** times today (limit: **${limit.cap}**). This prevents farming — try a different opponent or come back tomorrow.`,
          )],
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const result = await Mog.challenge(gid, interaction.user.id, target.id, {
        challenger: interaction.user.displayName,
        target: target.displayName,
      });

      // Shouldn't happen (we checked above) but guard anyway
      if (result.rateLimited) {
        return interaction.editReply({ embeds: [Embed.warning('Daily Limit Reached', `You can only challenge the same person **${result.cap}** times per day.`)] });
      }

      const winner = result.winnerId === interaction.user.id ? interaction.user : target;
      const loser  = result.winnerId === interaction.user.id ? target : interaction.user;

      const fields = [
        Embed.field('Winner',        `${winner}`,           true),
        Embed.field('Loser',         `${loser}`,            true),
        Embed.field('Points Gained', `+${result.pointsGained}`, true),
        Embed.field(`${interaction.user.displayName}`, String(result.challengerScore), true),
        Embed.field(`${target.displayName}`,           String(result.targetScore),    true),
      ];
      if (result.aiRatings) {
        const { challenger: c, target: t } = result.aiRatings;
        fields.push(Embed.field(
          'AI Rating',
          `**${c.score}** vs **${t.score}**\n${interaction.user.displayName}: ${c.verdict}\n${target.displayName}: ${t.verdict}`,
          false,
        ));
      }

      return interaction.editReply({
        embeds: [Embed.base({
          color:  result.won ? config.colors.success : config.colors.error,
          title:  result.won ? 'Face-off — Victory' : 'Face-off — Defeat',
          description: result.won
            ? `${interaction.user} eliminated ${target} in a Mog face-off.`
            : `${target} outmogged ${interaction.user}.`,
          fields,
          footer: 'Mog',
        })],
      });
    }

    // ── Profile ──────────────────────────────────────────────────────────────
    if (sub === 'profile') {
      const user    = interaction.options.getUser('user') ?? interaction.user;
      const profile = Mog.ensureProfile(gid, user.id);
      const total   = profile.wins + profile.losses;
      const winRate = total > 0 ? `${Math.round((profile.wins / total) * 100)}%` : 'N/A';
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.game,
          title: `${user.displayName}'s Mog Profile`,
          thumbnail: user.displayAvatarURL({ dynamic: true }),
          fields: [
            Embed.field('Points',     String(profile.points),                  true),
            Embed.field('Record',     `${profile.wins}W / ${profile.losses}L`, true),
            Embed.field('Win Rate',   winRate,                                 true),
            Embed.field('Pet',        profile.pet   || 'None',                 true),
            Embed.field('Aura',       profile.aura  || 'None',                 true),
            Embed.field('Power',      profile.power || 'None',                 true),
            Embed.field('Item Bonus', `+${Mog.scoreBonus(profile)} to score`,  false),
          ],
          footer: 'Mog',
        })],
      });
    }

    // ── Leaderboard ──────────────────────────────────────────────────────────
    if (sub === 'leaderboard') {
      const scope  = interaction.options.getString('scope') ?? 'server';
      const global = scope === 'global';

      await interaction.deferReply();
      const rows = global ? Mog.globalLeaderboard() : Mog.leaderboard(gid);

      const lines = rows.length
        ? rows.map((r, i) => {
            const pos    = i < 3 ? ['1.', '2.', '3.'][i] : `${i + 1}.`;
            const record = `${r.wins}W / ${r.losses}L`;
            const server = global && r.server_count > 1 ? ` · ${r.server_count} servers` : '';
            return `${pos} <@${r.user_id}> — **${r.points}** pts (${record}${server})`;
          })
        : [global ? 'No global Mog data yet.' : 'No matches in this server yet.'];

      return interaction.editReply({
        embeds: [Embed.base({
          color:       config.colors.gold,
          title:       global ? 'Mog Leaderboard — Global' : 'Mog Leaderboard — This Server',
          description: lines.join('\n'),
          footer:      global
            ? 'Global · Points earned across all servers'
            : 'Server · Use /mog leaderboard scope:Global for all servers',
        })],
      });
    }

    // ── Shop ─────────────────────────────────────────────────────────────────
    if (sub === 'shop') {
      const sections = Object.entries(Mog.ITEMS).map(([type, items]) => {
        const header = `**${type.charAt(0).toUpperCase() + type.slice(1)}**`;
        const lines  = Object.entries(items).map(([, item]) =>
          `\`${item.label}\` — ${item.price.toLocaleString()} coins — ${item.description}`
        ).join('\n');
        return `${header}\n${lines}`;
      });
      return interaction.reply({
        embeds: [Embed.base({ color: config.colors.primary, title: 'Mog Shop', description: sections.join('\n\n'), footer: 'Mog' })],
      });
    }

    // ── Inventory ────────────────────────────────────────────────────────────
    if (sub === 'inventory') {
      const items = Mog.inventory(gid, interaction.user.id);
      const desc  = items.length
        ? items.map(i => {
            const data = Mog.getItem(i.item_type, i.item_name);
            return `${data?.label ?? i.item_name} — ${data?.description ?? i.item_type}`;
          }).join('\n')
        : 'Your inventory is empty. Browse `/mog shop` to purchase items.';
      return interaction.reply({
        embeds: [Embed.base({ color: config.colors.primary, title: `${interaction.user.displayName}'s Inventory`, description: desc, footer: 'Mog' })],
      });
    }

    // ── Buy / Equip ──────────────────────────────────────────────────────────
    const type   = interaction.options.getString('type');
    const name   = interaction.options.getString('item').toLowerCase();
    const result = sub === 'buy'
      ? Mog.buy(gid, interaction.user.id, type, name)
      : Mog.equip(gid, interaction.user.id, type, name);

    if (result.error) return interaction.reply({ embeds: [Embed.error('Mog Item', result.error)], ephemeral: true });
    return interaction.reply({
      embeds: [Embed.success(sub === 'buy' ? 'Item Purchased' : 'Item Equipped', `**${result.item.label}** — ${result.item.description}`)],
    });
  },
};
