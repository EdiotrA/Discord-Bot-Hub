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
const play = require('play-dl');

const queues = new Map();

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

async function resolveSong(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) throw new Error('Enter a YouTube link or a song name.');

  const validation = play.yt_validate(cleanQuery);
  if (validation === 'video') {
    const info = await play.video_info(cleanQuery);
    const details = info.video_details;
    return {
      title: details.title,
      url: details.url || cleanQuery,
      duration: details.durationRaw || 'live',
      thumbnail: details.thumbnails?.at(-1)?.url,
    };
  }
  if (validation === 'playlist') {
    throw new Error('Playlist links are not supported yet. Paste a video link or search for a song.');
  }

  const results = await play.search(cleanQuery, { limit: 1, source: { youtube: 'video' } });
  if (!results.length) throw new Error('No results found.');
  const result = results[0];
  return {
    title: result.title,
    url: result.url,
    duration: result.durationRaw || 'live',
    thumbnail: result.thumbnails?.[0]?.url,
  };
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
    const stream = await play.stream(song.url, {
      quality: 2,
      discordPlayerCompatibility: true,
    });
    const resource = createAudioResource(stream.stream, {
      inputType: ['opus', 'webm_opus'].includes(stream.type) ? StreamType.WebmOpus : StreamType.Arbitrary,
      inlineVolume: true,
    });
    resource.volume?.setVolume(queue.volume / 100);
    queue.resource = resource;
    queue.player.play(resource);
  } catch (error) {
    queue.textChannel?.send({ embeds: [require('./embed').error('Playback Error', error.message.slice(0, 600))] }).catch(() => {});
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
  queue.player.stop();
  destroyQueue(queue.guildId);
  return true;
}

function destroyQueue(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  queue.connection.destroy();
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
  enqueue,
  waitUntilReady,
  skip,
  stop,
  destroyQueue,
  inVoiceChannel,
  queues,
};