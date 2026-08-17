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
