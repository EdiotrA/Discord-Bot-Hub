/** Thin Discord REST API client using the bot token. */

const DISCORD_API = "https://discord.com/api/v10";

function botHeaders() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

export interface PartialGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
  approximate_member_count?: number;
  approximate_presence_count?: number;
}

export interface FullGuild {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  approximate_member_count?: number;
  joined_at?: string;
}

export interface BotUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

/** Fetch the bot's own user object. */
export async function getBotUser(): Promise<BotUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, { headers: botHeaders() });
  if (!res.ok) throw new Error(`Discord /users/@me failed: ${res.status}`);
  return res.json() as Promise<BotUser>;
}

/** List all guilds the bot is in (up to 200, paginated if needed). */
export async function getBotGuilds(): Promise<PartialGuild[]> {
  const all: PartialGuild[] = [];
  let after: string | null = null;

  while (true) {
    const url = new URL(`${DISCORD_API}/users/@me/guilds`);
    url.searchParams.set("limit", "200");
    url.searchParams.set("with_counts", "true");
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url.toString(), { headers: botHeaders() });
    if (!res.ok) throw new Error(`Discord /users/@me/guilds failed: ${res.status}`);
    const batch = await res.json() as PartialGuild[];
    all.push(...batch);

    if (batch.length < 200) break;
    after = batch[batch.length - 1].id;
  }

  return all;
}

/** Get detailed guild info including owner and joined_at. */
export async function getGuild(guildId: string): Promise<FullGuild | null> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
    headers: botHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Discord /guilds/${guildId} failed: ${res.status}`);
  return res.json() as Promise<FullGuild>;
}

/** Remove the bot from a guild. */
export async function leaveGuild(guildId: string): Promise<void> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}`, {
    method: "DELETE",
    headers: botHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Discord leave guild ${guildId} failed: ${res.status}`);
  }
}

/** Build a CDN icon URL for a guild. */
export function guildIconUrl(guildId: string, icon: string | null): string | null {
  if (!icon) return null;
  const ext = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=64`;
}

/** Build a CDN avatar URL for a user. */
export function userAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=64`;
}

// ─── Member / Channel / Command helpers ────────────────────────────────────

export interface DiscordMember {
  user: { id: string; username: string; global_name: string | null; avatar: string | null; bot?: boolean };
  nick: string | null;
  avatar: string | null;
  roles: string[];
  joined_at: string;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  member_count?: number;
}

export interface DiscordCommand {
  id: string;
  name: string;
  description: string;
  type: number;
  guild_id?: string;
}

/** Channel type number → human-readable label */
const CHANNEL_TYPE_NAMES: Record<number, string> = {
  0: "Text", 1: "DM", 2: "Voice", 3: "Group DM", 4: "Category",
  5: "Announcement", 10: "Announcement Thread", 11: "Public Thread",
  12: "Private Thread", 13: "Stage", 14: "Directory", 15: "Forum", 16: "Media",
};
export function channelTypeName(type: number): string {
  return CHANNEL_TYPE_NAMES[type] ?? `Unknown(${type})`;
}

/** Fetch up to `limit` members from a guild (max 1000 per call, default 100). */
export async function getGuildMembers(guildId: string, limit = 100): Promise<DiscordMember[]> {
  const safeLimit = Math.min(Math.max(1, limit), 1000);
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members?limit=${safeLimit}`,
    { headers: botHeaders() },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Discord guild members failed: ${res.status}`);
  return res.json() as Promise<DiscordMember[]>;
}

/** Kick a member from a guild. */
export async function kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
  const headers: Record<string, string> = { ...botHeaders() };
  if (reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(reason);
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`Discord kick member failed: ${res.status} ${body}`);
  }
}

/** List all channels in a guild. */
export async function getGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: botHeaders(),
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Discord guild channels failed: ${res.status}`);
  return res.json() as Promise<DiscordChannel[]>;
}

/** Delete a channel. */
export async function deleteChannel(channelId: string, reason?: string): Promise<void> {
  const headers: Record<string, string> = { ...botHeaders() };
  if (reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(reason);
  const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok && res.status !== 200) {
    const body = await res.text();
    throw new Error(`Discord delete channel failed: ${res.status} ${body}`);
  }
}

/** Fetch global application commands. */
export async function getGlobalCommands(applicationId: string): Promise<DiscordCommand[]> {
  const res = await fetch(`${DISCORD_API}/applications/${applicationId}/commands`, {
    headers: botHeaders(),
  });
  if (!res.ok) throw new Error(`Discord global commands failed: ${res.status}`);
  return res.json() as Promise<DiscordCommand[]>;
}

/** Send a message to a Discord channel. */
export async function sendChannelMessage(channelId: string, content: string): Promise<{ id: string }> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: botHeaders(),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord send message failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<{ id: string }>;
}

/** Get the bot's own application ID (cached after first call). */
let _appId: string | null = null;
export async function getApplicationId(): Promise<string> {
  if (_appId) return _appId;
  const user = await getBotUser();
  _appId = user.id;
  return _appId;
}
