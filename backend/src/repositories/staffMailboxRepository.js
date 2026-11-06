const { query } = require("../../db");

async function find(userId) {
  const result = await query("SELECT user_id, email, password_enc FROM staff_mailboxes WHERE user_id = $1", [userId]);
  return result.rows[0] || null;
}

async function save(userId, email, passwordEnc) {
  await query(
    `INSERT INTO staff_mailboxes (user_id, email, password_enc)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, password_enc = EXCLUDED.password_enc, updated_at = NOW()`,
    [userId, email, passwordEnc]
  );
}

async function remove(userId) {
  await query("DELETE FROM staff_mailboxes WHERE user_id = $1", [userId]);
}

async function listAll() {
  const result = await query(
    `SELECT m.user_id, m.email, u.prenom, u.nom
     FROM staff_mailboxes m JOIN users u ON u.id = m.user_id
     ORDER BY u.prenom, u.nom`
  );
  return result.rows;
}

module.exports = { find, save, remove, listAll };
