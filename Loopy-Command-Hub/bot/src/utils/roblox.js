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
 * Set user's rank in group (requires Open Cloud API key with group permissions)
 */
async function setUserRank(groupId, userId, rankId) {
  try {
    const res = await axios.patch(
      `${ROBLOX_OPEN_CLOUD}/groups/${groupId}/memberships/${userId}`,
      { role: `groups/${groupId}/roles/${rankId}` },
      { headers: headers() }
    );
    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, error: err.response?.data?.message || err.message };
  }
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
  getGroupRoles,
  getUserGroupRank,
  getUserGroups,
  setUserRank,
  getGroupMemberCount,
  getFullProfile,
  generateVerifyCode,
  checkVerifyCode,
};
