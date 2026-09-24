const { query } = require("../../db");

async function findById(id) {
  const result = await query("SELECT * FROM conversations WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function findPair(studentId, salesId) {
  const result = await query(
    "SELECT * FROM conversations WHERE student_id = $1 AND sales_id = $2",
    [studentId, salesId]
  );
  return result.rows[0] || null;
}

async function createPair(studentId, salesId) {
  const existing = await findPair(studentId, salesId);
  if (existing) return existing;
  const result = await query(
    `INSERT INTO conversations (student_id, sales_id)
     VALUES ($1, $2)
     ON CONFLICT (student_id, sales_id) DO UPDATE SET updated_at = conversations.updated_at
     RETURNING *`,
    [studentId, salesId]
  );
  return result.rows[0];
}

async function listForViewer(auth) {
  const params = [auth.sub];
  let where = "";
  if (auth.role === "STUDENT") where = "WHERE c.student_id = $1";
  else if (auth.role === "SALES") where = "WHERE c.sales_id = $1";
  else where = "";

  const result = await query(
    `SELECT c.id, c.student_id, c.sales_id, c.updated_at,
            stu.prenom AS student_prenom, stu.nom AS student_nom, stu.avatar_url AS student_avatar_url,
            sal.prenom AS sales_prenom, sal.nom AS sales_nom, sal.avatar_url AS sales_avatar_url,
            last.body AS last_body,
            last.created_at AS last_at,
            COALESCE(unread.total, 0)::int AS unread
     FROM conversations c
     JOIN users stu ON stu.id = c.student_id
     JOIN users sal ON sal.id = c.sales_id
     LEFT JOIN LATERAL (
       SELECT body, created_at FROM messages
       WHERE conversation_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) last ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total
       FROM messages m
       LEFT JOIN message_reads r ON r.conversation_id = c.id AND r.user_id = $1
       WHERE m.conversation_id = c.id
         AND (m.sender_id <> $1 OR m.sender_id IS NULL)
         AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
     ) unread ON TRUE
     ${where}
     ORDER BY COALESCE(last.created_at, c.updated_at) DESC`,
    auth.role === "ADMIN" ? [auth.sub] : params
  );
  return result.rows;
}

async function listMessages(conversationId, limit = 100) {
  const result = await query(
    `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at,
            u.prenom AS sender_prenom, u.nom AS sender_nom, u.role AS sender_role,
            u.avatar_url AS sender_avatar_url
     FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows;
}

async function insertMessage(conversationId, senderId, body) {
  const result = await query(
    `INSERT INTO messages (conversation_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender_id, body, created_at`,
    [conversationId, senderId, body]
  );
  await query("UPDATE conversations SET updated_at = NOW() WHERE id = $1", [conversationId]);
  return result.rows[0];
}

async function markRead(conversationId, userId) {
  await query(
    `INSERT INTO message_reads (conversation_id, user_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET last_read_at = NOW()`,
    [conversationId, userId]
  );
}

async function unreadCount(userId) {
  const result = await query(
    `SELECT COUNT(DISTINCT c.id)::int AS total
     FROM conversations c
     JOIN messages m ON m.conversation_id = c.id
     LEFT JOIN message_reads r ON r.conversation_id = c.id AND r.user_id = $1
     WHERE (m.sender_id <> $1 OR m.sender_id IS NULL)
       AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
       AND (c.student_id = $1 OR c.sales_id = $1 OR EXISTS (
         SELECT 1 FROM users u WHERE u.id = $1 AND u.role = 'ADMIN'
       ))`,
    [userId]
  );
  return result.rows[0]?.total || 0;
}

module.exports = {
  findById,
  findPair,
  createPair,
  listForViewer,
  listMessages,
  insertMessage,
  markRead,
  unreadCount
};
