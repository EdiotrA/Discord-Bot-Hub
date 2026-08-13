const axios = require('axios');

const ROBLOX_API = 'https://apis.roblox.com';
const ROBLOX_OPEN_CLOUD = 'https://apis.roblox.com/cloud/v2';
const USERS_API = 'https://users.roblox.com/v1';
const GROUPS_API = 'https://groups.roblox.com/v1';
const THUMBNAILS_API = 'https://thumbnails.roblox.com/v1';

const headers = () => ({
  'x-api-key': process.env.ROBLOX_OPEN_CLOUD_KEY,
  'Content-Type': 'application/json',
});

// ── Cookie-authenticated requests (.ROBLOSECURITY) ────────────────────────────

const getCookieHeader = () => {
  const cookie = process.env.ROBLOX_COOKIE;
  if (!cookie) return null;
  return cookie.startsWith('.ROBLOSECURITY=') ? cookie : `.ROBLOSECURITY=${cookie}`;
};

let cachedCsrfToken = '';

/** Harvest a CSRF token (Roblox returns it in headers of any rejected POST). */
async function fetchCsrfToken(cookieHeader) {
  try {
    await axios.post('https://auth.roblox.com/v2/logout', {}, {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const token = err.response?.headers?.['x-csrf-token'];
    if (token) return token;
  }
  return '';
}

/**
 * Make an authenticated (cookie) request to a Roblox web API.
 * Handles CSRF token caching + one automatic retry when the token is stale.
 */
async function authedRequest(method, url, data = {}) {
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) {
    return { success: false, needsCookie: true, error: 'No `ROBLOX_COOKIE` secret set.' };
  }

  if (!cachedCsrfToken) cachedCsrfToken = await fetchCsrfToken(cookieHeader);

  const doRequest = () => axios({
    method, url, data,
    headers: {
      Cookie: cookieHeader,
      'X-CSRF-TOKEN': cachedCsrfToken,
      'Content-Type': 'application/json',
    },
  });

  try {
    const res = await doRequest();
    return { success: true, data: res.data };
  } catch (err) {
    // Stale/missing CSRF token → Roblox replies 403 with a fresh token in headers. Retry once.
    const freshToken = err.response?.headers?.['x-csrf-token'];
    if (err.response?.status === 403 && freshToken && freshToken !== cachedCsrfToken) {
      cachedCsrfToken = freshToken;
      try {
        const res = await doRequest();
        return { success: true, data: res.data };
      } catch (retryErr) {
        return authedError(retryErr);
      }
    }
    return authedError(err);
  }
}

function authedError(err) {
  const status = err.response?.status;
  const msg = err.response?.data?.errors?.[0]?.message
    || err.response?.data?.message
    || err.message;
  if (status === 401) {
    return {
      success: false, status,
      error: `Roblox session expired (401). Log into the bot Roblox account in a browser, copy a fresh \`.ROBLOSECURITY\` cookie, and update the \`ROBLOX_COOKIE\` secret.\n\nDetails: ${msg}`,
    };
  }
  if (status === 403) {
    return {
      success: false, status,
      error: `Permission denied (403). The bot's Roblox account doesn't have permission for this action — make sure it has a group role with the needed permissions.\n\nDetails: ${msg}`,
    };
  }
  return { success: false, status, error: msg || 'Unknown error from Roblox.' };
}

/**
 * Get Roblox user by username
 */
async function getUserByUsername(username) {
  try {
    const res = await axios.post('https://users.roblox.com/v1/usernames/users', {
      usernames: [username],
      excludeBannedUsers: false,
    });
    return res.data.data?.[0] || null;
  } catch { return null; }
}

/**
 * Get Roblox user by ID
 */
async function getUserById(userId) {
  try {
    const res = await axios.get(`${USERS_API}/users/${userId}`);
    return res.data;
  } catch { return null; }
}

/**
 * Get user avatar thumbnail
 */
async function getUserThumbnail(userId) {
  try {
    const res = await axios.get(`${THUMBNAILS_API}/users/avatar-headshot`, {
      params: { userIds: userId, size: '150x150', format: 'Png', isCircular: false },
    });
    return res.data.data?.[0]?.imageUrl || null;
  } catch { return null; }
}

/**
 * Get group info
 */
async function getGroupInfo(groupId) {
  try {
    const res = await axios.get(`${GROUPS_API}/groups/${groupId}`);
    return res.data;
  } catch { return null; }
}

/**
 * Get all roles in a group
 */
async function getGroupRoles(groupId) {
  try {
    const res = await axios.get(`${GROUPS_API}/groups/${groupId}/roles`);
    return res.data.roles || [];
  } catch { return []; }
}

/**
 * Get a user's rank in a group
 */
async function getUserGroupRank(userId, groupId) {
  try {
    const res = await axios.get(`${GROUPS_API}/users/${userId}/groups/roles`);
    const group = res.data.data?.find(g => String(g.group.id) === String(groupId));
    return group ? group.role : null;
  } catch { return null; }
}

/**
 * Get user's groups
 */
async function getUserGroups(userId) {
  try {
    const res = await axios.get(`${GROUPS_API}/users/${userId}/groups/roles`);
    return res.data.data || [];
  } catch { return []; }
}

/**
 * Set user's rank in group (requires Open Cloud API key with group permissions).
 * @param {string|number} groupId  - Roblox group ID
 * @param {string|number} userId   - Roblox user ID
 * @param {string|number} roleId   - Roblox role ID (the actual large ID, NOT the rank number 1-255)
 */
async function setUserRank(groupId, userId, roleId) {
  const hasCookie = Boolean(getCookieHeader());
  const hasCloudKey = Boolean(process.env.ROBLOX_OPEN_CLOUD_KEY);

  if (!hasCookie && !hasCloudKey) {
    return {
      success: false,
      error: 'Neither `ROBLOX_COOKIE` nor `ROBLOX_OPEN_CLOUD_KEY` is configured. Set the `ROBLOX_COOKIE` secret to the bot account\'s .ROBLOSECURITY cookie.',
    };
  }

  // Preferred path: cookie-authenticated legacy groups API (works with just ROBLOX_COOKIE).
  if (hasCookie) {
    const result = await authedRequest(
      'patch',
      `${GROUPS_API}/groups/${groupId}/users/${userId}`,
      { roleId: Number(roleId) }
    );
    if (result.success) return result;
    if (result.status === 403) {
      result.error = `Permission denied (403). The bot's Roblox account must be in the group with a role that has the **Manage lower-ranked member ranks** permission, and its rank must be ABOVE the target rank.\n\nDetails: ${result.error.split('Details: ').pop()}`;
    }
    // If the cookie is unauthorized/expired but an Open Cloud key is available, fall through to it.
    if (!hasCloudKey || (result.status !== 401 && result.status !== 403)) return result;
  }

  try {
    // Step 1: look up the membership resource path for this user.
    // The Roblox Open Cloud v2 memberships endpoint uses a membership ID
    // that is distinct from the user ID, so we must discover it first.
    const listRes = await axios.get(
      `${ROBLOX_OPEN_CLOUD}/groups/${groupId}/memberships`,
      {
        params: { filter: `user == 'users/${userId}'`, maxPageSize: 1 },
        headers: headers(),
      }
    );

    const memberships = listRes.data?.groupMemberships ?? listRes.data?.memberships ?? [];
    if (!memberships.length) {
      return { success: false, error: 'User is not a member of this group.' };
    }

    // The resource path is e.g. "groups/123/memberships/456"
    const membershipPath = memberships[0].path;
    const membershipId = membershipPath?.split('/').pop();
    if (!membershipId) {
      return { success: false, error: 'Could not determine membership ID from Roblox API response.' };
    }

    // Step 2: PATCH the membership to assign the new role.
    const patchRes = await axios.patch(
      `${ROBLOX_OPEN_CLOUD}/groups/${groupId}/memberships/${membershipId}`,
      { role: `groups/${groupId}/roles/${roleId}` },
      { headers: headers() }
    );
    return { success: true, data: patchRes.data };
  } catch (err) {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;

    if (status === 403) {
      return {
        success: false,
        error: `Permission denied (403). Ensure your Open Cloud API key has **Group: Write** permission and belongs to the group owner account.\nDetails: ${msg}`,
      };
    }
    if (status === 401) {
      return {
        success: false,
        error: `Invalid API key (401). Check that ROBLOX_OPEN_CLOUD_KEY is correct.\nDetails: ${msg}`,
      };
    }
    return { success: false, error: msg || 'Unknown error from Roblox API.' };
  }
}

/**
 * Make the bot's Roblox account join a group.
 * Requires ROBLOX_COOKIE env var (the .ROBLOSECURITY cookie from the bot account).
 *
 * Flow:
 *  1. POST to a protected endpoint to harvest the CSRF token Roblox requires.
 *  2. POST to the group join endpoint with the cookie + CSRF token.
 */
async function joinGroup(groupId) {
  const result = await authedRequest('post', `${GROUPS_API}/groups/${groupId}/users`, {});
  if (!result.success && result.status === 400) {
    result.error = `Could not join: ${result.error}`;
  }
  return result;
}

/**
 * Make the bot's Roblox account leave a group.
 */
async function leaveGroup(groupId) {
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) return { success: false, needsCookie: true, error: 'No `ROBLOX_COOKIE` secret set.' };
  const me = await getAuthenticatedUser();
  if (!me) return { success: false, error: 'Could not resolve the bot Roblox account — cookie may be expired.' };
  return authedRequest('delete', `${GROUPS_API}/groups/${groupId}/users/${me.id}`);
}

/**
 * Get the Roblox account the cookie is logged in as.
 */
async function getAuthenticatedUser() {
  const cookieHeader = getCookieHeader();
  if (!cookieHeader) return null;
  try {
    const res = await axios.get(`${USERS_API}/users/authenticated`, {
      headers: { Cookie: cookieHeader },
    });
    return res.data;
  } catch { return null; }
}

/**
 * Get group icon thumbnail URL
 */
async function getGroupThumbnail(groupId) {
  try {
    const res = await axios.get(`${THUMBNAILS_API}/groups/icons`, {
      params: { groupIds: groupId, size: '150x150', format: 'Png', isCircular: false },
    });
    return res.data.data?.[0]?.imageUrl || null;
  } catch { return null; }
}

/**
 * Get group members count
 */
async function getGroupMemberCount(groupId) {
  try {
    const info = await getGroupInfo(groupId);
    return info?.memberCount || 0;
  } catch { return 0; }
}

/**
 * Search for a user and get their profile
 */
async function getFullProfile(username) {
  const user = await getUserByUsername(username);
  if (!user) return null;
  const [details, thumbnail] = await Promise.all([
    getUserById(user.id),
    getUserThumbnail(user.id),
  ]);
  return { ...user, ...details, thumbnail };
}

/**
 * Generate a verification code for a user
 */
function generateVerifyCode(discordUserId) {
  const base = discordUserId.slice(-6);
  const hash = parseInt(base, 10) % 89999 + 10000;
  return `LOOPY-${hash}`;
}

/**
 * Check if a Roblox profile's description contains a verification code
 */
async function checkVerifyCode(robloxUserId, code) {
  try {
    const user = await getUserById(robloxUserId);
    return user?.description?.includes(code) || false;
  } catch { return false; }
}

module.exports = {
  getUserByUsername,
  getUserById,
  getUserThumbnail,
  getGroupInfo,
  getGroupThumbnail,
  getGroupRoles,
  getUserGroupRank,
  getUserGroups,
  setUserRank,
  joinGroup,
  leaveGroup,
  getAuthenticatedUser,
  getGroupMemberCount,
  getFullProfile,
  generateVerifyCode,
  checkVerifyCode,
};
