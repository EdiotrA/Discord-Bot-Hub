const {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const play = require('play-dl');

const queues = new Map();

// ── Search / Metadata (play-dl is fine for this) ───────────────────────────

async function searchSongs(query, limit = 5) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];
  try {
    const validation = play.yt_validate(cleanQuery);
    if (validation === 'video') {
      const info = await play.video_info(cleanQuery);
      const d = info.video_details;
      return [{
        title: d.title || 'Unknown',
        url: d.url || cleanQuery,
        duration: d.durationRaw || 'live',
        thumbnail: d.thumbnails?.at(-1)?.url || null,
      }];
    }
    const results = await play.search(cleanQuery, { limit, source: { youtube: 'video' } });
    return results.map(r => ({
      title: r.title || 'Unknown',
      url: r.url,
      duration: r.durationRaw || 'live',
      thumbnail: r.thumbnails?.[0]?.url || null,
    }));
  } catch {
    return [];
  }
}

async function resolveSong(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new Error('Enter a YouTube link or a song name.');
  const results = await searchSongs(cleanQuery, 1);
  if (!results.length) throw new Error('No results found for that query.');
  return results[0];
}

// ── yt-dlp streaming (reliable, always up-to-date) ─────────────────────────

function createYtdlpStream(url) {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      '-o', '-',
      url,
    ];
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let errBuf = '';
    proc.stderr.on('data', d => { errBuf += d.toString(); });

    // Give yt-dlp a moment to start writing, then resolve with the stdout stream
    // We reject if yt-dlp exits with a non-zero code before data flows
    let started = false;
    proc.stdout.once('data', () => { started = true; resolve({ stream: proc.stdout, proc }); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (!started) reject(new Error(errBuf.slice(0, 300) || `yt-dlp exited with code ${code}`));
    });
  });
}

// ── Queue management ────────────────────────────────────────────────────────

function getQueue(guildId) {
  return queues.get(guildId) || null;
}

function ensureQueue(guildId, voiceChannel, textChannel) {
  let queue = queues.get(guildId);
  if (queue) {
    if (queue.voiceChannel.id !== voiceChannel.id) {
      throw new Error(`I am already playing music in <#${queue.voiceChannel.id}>. Join that voice channel first.`);
    }
    queue.voiceChannel = voiceChannel;
    queue.textChannel = textChannel;
    return queue;
  }

  const existingBotChannel = voiceChannel.guild.members.me?.voice?.channel;
  if (existingBotChannel && existingBotChannel.id !== voiceChannel.id) {
    throw new Error(`I am already in <#${existingBotChannel.id}>. Join that voice channel first.`);
  }

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  connection.subscribe(player);
  queue = {
    guildId,
    voiceChannel,
    textChannel,
    player,
    connection,
    songs: [],
    current: null,
    volume: 100,
    loop: 'off',
    loading: false,
    resource: null,
    _ytProc: null,
  };
  player.on(AudioPlayerStatus.Idle, () => finishSong(queue));
  player.on('error', (error) => {
    queue.textChannel?.send({ embeds: [require('./embed').error('Music Error', error.message.slice(0, 600))] }).catch(() => {});
    finishSong(queue);
  });
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      destroyQueue(guildId);
    }
  });
  queues.set(guildId, queue);
  return queue;
}

async function waitUntilReady(queue) {
  await entersState(queue.connection, VoiceConnectionStatus.Ready, 15_000);
  return queue;
}

async function playNext(queue) {
  if (!queue.songs.length) {
    queue.current = null;
    queue.resource = null;
    return;
  }
  queue.loading = true;
  const song = queue.songs[0];
  queue.current = song;
  try {
    // Kill any previous yt-dlp process
    if (queue._ytProc) { try { queue._ytProc.kill(); } catch {} queue._ytProc = null; }

    const { stream, proc } = await createYtdlpStream(song.url);
    queue._ytProc = proc;

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(queue.volume / 100);
    queue.resource = resource;
    queue.player.play(resource);
  } catch (error) {
    const msg = error.message?.slice(0, 500) || 'Unknown error';
    queue.textChannel?.send({ embeds: [require('./embed').error('Playback Error', `Could not play **${song.title}**.\n\`\`\`${msg}\`\`\``)] }).catch(() => {});
    queue.songs.shift();
    queue.loading = false;
    return playNext(queue);
  }
  queue.loading = false;
}

function finishSong(queue) {
  if (!queue.current) return;
  if (queue.loop === 'song') return playNext(queue);
  const finished = queue.songs.shift();
  if (queue.loop === 'queue' && finished) queue.songs.push(finished);
  playNext(queue);
}

function enqueue(queue, song) {
  queue.songs.push(song);
  if (!queue.current && !queue.loading) return playNext(queue);
  return null;
}

function skip(queue) {
  if (!queue?.current) return false;
  queue.player.stop();
  return true;
}

function stop(queue) {
  if (!queue) return false;
  queue.songs = [];
  queue.current = null;
  if (queue._ytProc) { try { queue._ytProc.kill(); } catch {} queue._ytProc = null; }
  queue.player.stop();
  destroyQueue(queue.guildId);
  return true;
}

function destroyQueue(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  if (queue._ytProc) { try { queue._ytProc.kill(); } catch {} }
  try { queue.connection.destroy(); } catch {}
  queues.delete(guildId);
}

function inVoiceChannel(interaction, queue) {
  const channelId = interaction.member?.voice?.channelId;
  if (!channelId || channelId !== queue?.voiceChannel?.id) {
    interaction.reply({
      embeds: [require('./embed').error('Join My Voice Channel', `Join <#${queue?.voiceChannel?.id || 'the music channel'}> before controlling playback.`)],
      ephemeral: true,
    }).catch(() => {});
    return false;
  }
  return true;
}

module.exports = {
  getQueue,
  ensureQueue,
  resolveSong,
  searchSongs,
  enqueue,
  waitUntilReady,
  skip,
  stop,
  destroyQueue,
  inVoiceChannel,
  queues,
};
