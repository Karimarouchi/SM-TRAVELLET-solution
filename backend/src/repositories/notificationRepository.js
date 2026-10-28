const { query } = require("../../db");

async function createForUsers(userIds, { type, title, body, link }) {
  if (!userIds.length) return;
  await query(
    `INSERT INTO notifications (user_id, type, title, body, link)
     SELECT user_id, $2, $3, $4, $5 FROM UNNEST($1::uuid[]) AS user_id`,
    [userIds, type, title, body || null, link || null]
  );
}

async function listActiveAdminIds() {
  const result = await query(
    `SELECT DISTINCT u.id
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE u.is_active = TRUE AND (u.role = 'ADMIN' OR ur.role = 'ADMIN')`
  );
  return result.rows.map((row) => row.id);
}

// Espace admin « RH » : congés, paie, documents et contrats des employés.
// Tout le reste (étudiants, dossiers, WhatsApp...) appartient à l'espace « Clients ».
const HR_TYPES = "(type LIKE 'HR\\_%' OR type = 'SALARY_DUE')";

function areaClause(area) {
  if (area === "hr") return ` AND ${HR_TYPES}`;
  if (area === "clients") return ` AND NOT ${HR_TYPES}`;
  return "";
}

async function listForUser(userId, { before, limit, unreadOnly, area }) {
  const result = await query(
    `SELECT id, type, title, body, link, read_at, created_at
     FROM notifications
     WHERE user_id = $1
       AND ($2::timestamptz IS NULL OR created_at < $2)
       AND ($4::boolean IS NOT TRUE OR read_at IS NULL)${areaClause(area)}
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, before, limit, unreadOnly]
  );
  return result.rows;
}

async function unreadCount(userId, area) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL${areaClause(area)}`,
    [userId]
  );
  return result.rows[0].count;
}

async function markRead(userId, id) {
  await query(
    "UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
    [id, userId]
  );
}

async function markAllRead(userId, area) {
  await query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL${areaClause(area)}`, [userId]);
}

module.exports = { createForUsers, listActiveAdminIds, listForUser, unreadCount, markRead, markAllRead };
