const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Embed = require('../../utils/embed');
const Music = require('../../utils/music');
const { db } = require('../../database');

// ── DB helpers ────────────────────────────────────────────────────────────────

function getPlaylist(userId, name) {
  const row = db.prepare('SELECT * FROM user_playlists WHERE user_id = ? AND name = ? COLLATE NOCASE').get(userId, name);
  if (!row) return null;
  try { row.songs = JSON.parse(row.songs); } catch { row.songs = []; }
  return row;
}

function getUserPlaylists(userId) {
  return db.prepare('SELECT id, name, songs, created_at, updated_at FROM user_playlists WHERE user_id = ? ORDER BY updated_at DESC').all(userId).map(r => {
    try { r.songs = JSON.parse(r.songs); } catch { r.songs = []; }
    return r;
  });
}

function savePlaylist(userId, name, songs) {
  db.prepare(`
    INSERT INTO user_playlists (user_id, name, songs, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id, name) DO UPDATE SET songs = excluded.songs, updated_at = excluded.updated_at
  `).run(userId, name, JSON.stringify(songs));
}

function deletePlaylist(userId, name) {
  return db.prepare('DELETE FROM user_playlists WHERE user_id = ? AND name = ? COLLATE NOCASE').run(userId, name).changes > 0;
}

// ── Shared embed ──────────────────────────────────────────────────────────────

function songList(songs, start = 0) {
  if (!songs.length) return '*No songs yet.*';
  return songs.slice(start, start + 20).map((s, i) =>
    `\`${start + i + 1}.\` **${s.title.slice(0, 60)}** \`${s.duration || '?'}\``
  ).join('\n');
}

// ── Command ───────────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Save and load your personal music playlists — works across every server Loopy is in')

    .addSubcommand(s => s.setName('list').setDescription('See all your saved playlists'))

    .addSubcommand(s => s.setName('view')
      .setDescription('Show songs inside a playlist')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true))
    )

    .addSubcommand(s => s.setName('save')
      .setDescription('Save the current queue as a playlist (overwrites if name exists)')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true).setMaxLength(40))
    )

    .addSubcommand(s => s.setName('load')
      .setDescription('Load a saved playlist into the queue')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true))
      .addStringOption(o => o.setName('mode')
        .setDescription('Add to existing queue, or replace it')
        .setRequired(false)
        .addChoices(
          { name: 'Add to queue', value: 'add' },
          { name: 'Replace queue', value: 'replace' },
        )
      )
    )

    .addSubcommand(s => s.setName('add')
      .setDescription('Add a song to a saved playlist')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true))
      .addStringOption(o => o.setName('query').setDescription('Song name or YouTube URL').setRequired(true))
    )

    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a song from a playlist by its position')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true))
      .addIntegerOption(o => o.setName('position').setDescription('Song number (from /playlist view)').setRequired(true).setMinValue(1))
    )

    .addSubcommand(s => s.setName('delete')
      .setDescription('Permanently delete one of your playlists')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const playlists = getUserPlaylists(userId);
      if (!playlists.length) {
        return interaction.reply({
          embeds: [Embed.info('🎵 Your Playlists', 'You have no saved playlists yet.\nUse `/playlist save <name>` while music is playing to save the current queue.')],
          ephemeral: true,
        });
      }
      const lines = playlists.map((p, i) =>
        `\`${i + 1}.\` **${p.name}** — ${p.songs.length} song${p.songs.length !== 1 ? 's' : ''}`
      );
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`🎵 ${interaction.user.displayName}'s Playlists`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''} • Works in any server` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── view ──────────────────────────────────────────────────────────────────
    if (sub === 'view') {
      const name = interaction.options.getString('name');
      const pl = getPlaylist(userId, name);
      if (!pl) return interaction.reply({ embeds: [Embed.error('Not Found', `You don't have a playlist called **${name}**.\nUse \`/playlist list\` to see your playlists.`)], ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`🎵 ${pl.name}`)
        .setDescription(songList(pl.songs))
        .setFooter({ text: `${pl.songs.length} song${pl.songs.length !== 1 ? 's' : ''} · load with /playlist load ${pl.name}` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── save ──────────────────────────────────────────────────────────────────
    if (sub === 'save') {
      const name = interaction.options.getString('name').trim();
      const queue = Music.getQueue(interaction.guildId);
      if (!queue || !queue.songs.length) {
        return interaction.reply({ embeds: [Embed.error('Queue Empty', 'There are no songs in the queue to save.\nStart playing music first with `/play`.')], ephemeral: true });
      }
      const songs = [...queue.songs]; // snapshot current queue
      savePlaylist(userId, name, songs);
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Playlist Saved')
        .setDescription(`**${name}** saved with **${songs.length}** song${songs.length !== 1 ? 's' : ''}.\nThis playlist is yours across every server Loopy is in.`)
        .addFields({ name: 'First song', value: songs[0].title.slice(0, 80), inline: true })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── load ──────────────────────────────────────────────────────────────────
    if (sub === 'load') {
      const name = interaction.options.getString('name');
      const mode = interaction.options.getString('mode') || 'add';
      const pl = getPlaylist(userId, name);
      if (!pl) return interaction.reply({ embeds: [Embed.error('Not Found', `No playlist named **${name}**.\nUse \`/playlist list\` to see your playlists.`)], ephemeral: true });
      if (!pl.songs.length) return interaction.reply({ embeds: [Embed.error('Empty Playlist', `**${name}** has no songs. Add some with \`/playlist add\`.`)], ephemeral: true });

      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) return interaction.reply({ embeds: [Embed.error('Join a Voice Channel', 'You need to be in a voice channel to load a playlist.')], ephemeral: true });

      await interaction.deferReply();
      try {
        const queue = Music.ensureQueue(interaction.guildId, voiceChannel, interaction.channel);
        await Music.waitUntilReady(queue);

        if (mode === 'replace') {
          queue.songs = [];
          queue.current = null;
          Music.killProcs?.(queue);
          queue.player.stop();
        }

        for (const song of pl.songs) Music.enqueue(queue, song);

        const embed = new EmbedBuilder()
          .setColor(0x9B59B6)
          .setTitle(`🎵 Loaded — ${pl.name}`)
          .setDescription(
            mode === 'replace'
              ? `Replaced the queue with **${pl.songs.length}** songs from your playlist.`
              : `Added **${pl.songs.length}** songs from your playlist to the queue.`
          )
          .addFields(
            { name: 'Songs added', value: String(pl.songs.length), inline: true },
            { name: 'Queue total', value: String(queue.songs.length), inline: true },
            { name: '🔁 Tip', value: 'Use `/loop queue` to repeat this playlist forever.', inline: false },
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ embeds: [Embed.error('Load Error', err.message.slice(0, 500))] });
      }
    }

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === 'add') {
      const name = interaction.options.getString('name');
      const query = interaction.options.getString('query');
      const pl = getPlaylist(userId, name);
      if (!pl) return interaction.reply({ embeds: [Embed.error('Not Found', `No playlist named **${name}**. Check \`/playlist list\`.`)], ephemeral: true });
      if (pl.songs.length >= 200) return interaction.reply({ embeds: [Embed.error('Playlist Full', 'Max 200 songs per playlist.')], ephemeral: true });

      await interaction.deferReply({ ephemeral: true });
      const song = await Music.resolveSong(query);
      pl.songs.push(song);
      savePlaylist(userId, name, pl.songs);
      return interaction.editReply({ embeds: [Embed.music('➕ Added to Playlist', `**${song.title}** added to **${name}**.\nPlaylist now has **${pl.songs.length}** song${pl.songs.length !== 1 ? 's' : ''}.`)] });
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === 'remove') {
      const name = interaction.options.getString('name');
      const pos = interaction.options.getInteger('position');
      const pl = getPlaylist(userId, name);
      if (!pl) return interaction.reply({ embeds: [Embed.error('Not Found', `No playlist named **${name}**.`)], ephemeral: true });
      if (pos > pl.songs.length) return interaction.reply({ embeds: [Embed.error('Out of Range', `Position ${pos} doesn't exist — playlist has ${pl.songs.length} songs.`)], ephemeral: true });
      const [removed] = pl.songs.splice(pos - 1, 1);
      savePlaylist(userId, name, pl.songs);
      return interaction.reply({ embeds: [Embed.music('🗑️ Removed', `**${removed.title}** removed from **${name}**.\nPlaylist now has **${pl.songs.length}** song${pl.songs.length !== 1 ? 's' : ''}.`)], ephemeral: true });
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const name = interaction.options.getString('name');
      const deleted = deletePlaylist(userId, name);
      if (!deleted) return interaction.reply({ embeds: [Embed.error('Not Found', `No playlist named **${name}** to delete.`)], ephemeral: true });
      return interaction.reply({ embeds: [Embed.success('🗑️ Deleted', `Playlist **${name}** has been permanently deleted.`)], ephemeral: true });
    }
  },
};
