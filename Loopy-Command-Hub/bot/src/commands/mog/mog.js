const { SlashCommandBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Mog = require('../../utils/mog');
const config = require('../../config');

const TYPE_CHOICES = [
  { name: 'Pet',   value: 'pets' },
  { name: 'Aura',  value: 'auras' },
  { name: 'Power', value: 'powers' },
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
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the Mog points leaderboard'))
    .addSubcommand(s => s.setName('shop').setDescription('Browse pets, auras, and powers'))
    .addSubcommand(s => s.setName('inventory').setDescription('View your owned Mog items'))
    .addSubcommand(s => s
      .setName('buy')
      .setDescription('Purchase a Mog item')
      .addStringOption(o => o
        .setName('type').setDescription('Item category').setRequired(true).addChoices(...TYPE_CHOICES))
      .addStringOption(o => o
        .setName('item').setDescription('Item to buy').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('equip')
      .setDescription('Equip an owned Mog item')
      .addStringOption(o => o
        .setName('type').setDescription('Item category').setRequired(true).addChoices(...TYPE_CHOICES))
      .addStringOption(o => o
        .setName('item').setDescription('Item to equip').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const sub  = interaction.options.getSubcommand(false);
    const type = interaction.options.getString('type');
    if (!type) return interaction.respond([]);

    // For equip: only show owned items. For buy: show all with ownership indicator.
    const ownedOnly = sub === 'equip';
    const gid = ownedOnly ? interaction.guildId : null;
    const uid = ownedOnly ? interaction.user.id : null;
    const choices = Mog.itemChoices(type, gid, uid);
    return interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction) {
    const gid = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    // ── Challenge ────────────────────────────────────────────────────────────
    if (sub === 'challenge') {
      const target = interaction.options.getUser('user');
      if (target.bot || target.id === interaction.user.id) {
        return interaction.reply({
          embeds: [Embed.error('Invalid Target', 'Choose a different human member to challenge.')],
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      const result = await Mog.challenge(gid, interaction.user.id, target.id, {
        challenger: interaction.user.displayName,
        target: target.displayName,
      });
      const winner = result.winnerId === interaction.user.id ? interaction.user : target;
      const loser  = result.winnerId === interaction.user.id ? target : interaction.user;

      const challengerScore = result.challengerScore;
      const targetScore     = result.targetScore;

      const color  = result.won ? config.colors.success : config.colors.error;
      const title  = result.won ? 'Face-off — Victory' : 'Face-off — Defeat';
      const summary = result.won
        ? `${interaction.user} eliminated ${target} in a Mog face-off.`
        : `${target} outmogged ${interaction.user}.`;

      const fields = [
        Embed.field('Winner', `${winner}`, true),
        Embed.field('Loser',  `${loser}`,  true),
        Embed.field('Points Gained', `+${result.pointsGained}`, true),
        Embed.field(`${interaction.user.displayName} Score`, String(challengerScore), true),
        Embed.field(`${target.displayName} Score`,           String(targetScore),     true),
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
          color,
          title,
          description: summary,
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
      const bonus   = Mog.scoreBonus(profile);

      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.game,
          title: `${user.displayName}'s Mog Profile`,
          thumbnail: user.displayAvatarURL({ dynamic: true }),
          fields: [
            Embed.field('Points',   String(profile.points), true),
            Embed.field('Record',   `${profile.wins}W / ${profile.losses}L`, true),
            Embed.field('Win Rate', winRate, true),
            Embed.field('Pet',   profile.pet   || 'None', true),
            Embed.field('Aura',  profile.aura  || 'None', true),
            Embed.field('Power', profile.power || 'None', true),
            Embed.field('Item Bonus', `+${bonus} to score`, false),
          ],
          footer: 'Mog',
        })],
      });
    }

    // ── Leaderboard ──────────────────────────────────────────────────────────
    if (sub === 'leaderboard') {
      const rows = Mog.leaderboard(gid);
      const medals = ['1.', '2.', '3.'];
      const lines = rows.length
        ? rows.map((r, i) => `${medals[i] ?? `${i + 1}.`} <@${r.user_id}> — **${r.points}** pts (${r.wins}W / ${r.losses}L)`)
        : ['No Mog matches have been played yet.'];
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.gold,
          title: 'Mog Leaderboard',
          description: lines.join('\n'),
          footer: 'Mog',
        })],
      });
    }

    // ── Shop ─────────────────────────────────────────────────────────────────
    if (sub === 'shop') {
      const sections = Object.entries(Mog.ITEMS).map(([type, items]) => {
        const header = `**${type.charAt(0).toUpperCase() + type.slice(1)}**`;
        const lines = Object.entries(items).map(([, item]) =>
          `\`${item.label}\` — ${item.price.toLocaleString()} coins — ${item.description}`
        ).join('\n');
        return `${header}\n${lines}`;
      });
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.primary,
          title: 'Mog Shop',
          description: sections.join('\n\n'),
          footer: 'Mog',
        })],
      });
    }

    // ── Inventory ────────────────────────────────────────────────────────────
    if (sub === 'inventory') {
      const items = Mog.inventory(gid, interaction.user.id);
      const desc = items.length
        ? items.map(i => {
            const cat  = i.item_type;
            const data = Mog.getItem(cat, i.item_name);
            return `${data?.label ?? i.item_name} — ${data?.description ?? cat}`;
          }).join('\n')
        : 'Your inventory is empty. Browse `/mog shop` to purchase items.';
      return interaction.reply({
        embeds: [Embed.base({
          color: config.colors.primary,
          title: `${interaction.user.displayName}'s Inventory`,
          description: desc,
          footer: 'Mog',
        })],
      });
    }

    // ── Buy / Equip ──────────────────────────────────────────────────────────
    const type   = interaction.options.getString('type');
    const name   = interaction.options.getString('item').toLowerCase();
    const result = sub === 'buy'
      ? Mog.buy(gid, interaction.user.id, type, name)
      : Mog.equip(gid, interaction.user.id, type, name);

    if (result.error) {
      return interaction.reply({ embeds: [Embed.error('Mog Item', result.error)], ephemeral: true });
    }
    return interaction.reply({
      embeds: [Embed.success(
        sub === 'buy' ? 'Item Purchased' : 'Item Equipped',
        `**${result.item.label}** — ${result.item.description}`,
      )],
    });
  },
};
