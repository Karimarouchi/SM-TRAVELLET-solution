const { query } = require("../../db");

const PERMISSIONS = ["MANAGE_PROGRAMMES", "MANAGE_COUNTRIES", "MANAGE_AVIS", "MANAGE_VISA_DOCUMENTS"];

async function listForUser(userId) {
  const result = await query("SELECT permission FROM user_permissions WHERE user_id = $1 ORDER BY permission", [userId]);
  return result.rows.map((r) => r.permission);
}

async function setForUser(userId, permissions) {
  await query("DELETE FROM user_permissions WHERE user_id = $1", [userId]);
  for (const permission of permissions) {
    if (!PERMISSIONS.includes(permission)) continue;
    await query(
      "INSERT INTO user_permissions (user_id, permission) VALUES ($1, $2) ON CONFLICT (user_id, permission) DO NOTHING",
      [userId, permission]
    );
  }
}

module.exports = { PERMISSIONS, listForUser, setForUser };
