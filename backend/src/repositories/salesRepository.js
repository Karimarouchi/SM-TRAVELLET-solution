const { query } = require("../../db");

async function ensureProfile(userId) {
  const existing = await query("SELECT * FROM sales_profiles WHERE user_id = $1", [userId]);
  if (existing.rowCount) return existing.rows[0];
  const created = await query(
    `INSERT INTO sales_profiles (user_id, job_title) VALUES ($1, $2) RETURNING *`,
    [userId, "Conseiller"]
  );
  return created.rows[0];
}

async function findByUserId(userId) {
  const result = await query("SELECT * FROM sales_profiles WHERE user_id = $1", [userId]);
  return result.rows[0] || null;
}

async function updatePhone(userId, phone) {
  await ensureProfile(userId);
  const result = await query(
    `UPDATE sales_profiles SET phone = $2, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
    [userId, phone]
  );
  return result.rows[0] || null;
}

async function listBoard() {
  const sales = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, u.is_active, u.created_at,
            COALESCE(sp.phone, '') AS phone,
            COALESCE(sp.job_title, 'Conseiller') AS job_title,
            COUNT(st.user_id)::int AS student_count
     FROM users u
     LEFT JOIN sales_profiles sp ON sp.user_id = u.id
     LEFT JOIN student_profiles st ON st.assigned_sales_id = u.id
     WHERE u.role = 'SALES'
     GROUP BY u.id, u.prenom, u.nom, u.email, u.is_active, u.created_at, sp.phone, sp.job_title
     ORDER BY u.created_at ASC`
  );
  return sales.rows;
}

async function findLeastLoadedActive() {
  const result = await query(
    `SELECT u.id, COUNT(st.user_id)::int AS load
     FROM users u
     LEFT JOIN student_profiles st ON st.assigned_sales_id = u.id
     WHERE u.role = 'SALES' AND u.is_active = TRUE
     GROUP BY u.id, u.created_at
     ORDER BY load ASC, u.created_at ASC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

module.exports = { ensureProfile, findByUserId, updatePhone, listBoard, findLeastLoadedActive };
