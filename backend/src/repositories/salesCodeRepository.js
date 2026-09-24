const { query } = require("../../db");

async function findByCode(code) {
  const result = await query(`SELECT * FROM sales_codes WHERE code = $1`, [code]);
  return result.rows[0] || null;
}

async function findBySales(salesId) {
  const result = await query(
    `SELECT sc.*, c.name AS country_name, u.prenom AS used_by_prenom, u.nom AS used_by_nom
     FROM sales_codes sc
     LEFT JOIN countries c ON c.id = sc.country_id
     LEFT JOIN users u ON u.id = sc.used_by_student_id
     WHERE sc.sales_id = $1
     ORDER BY sc.created_at DESC`,
    [salesId]
  );
  return result.rows;
}

async function create({ code, salesId, countryId, prefillCurrentStudyLevel, prefillTargetLevel, prefillPhone, expiresAt }) {
  const result = await query(
    `INSERT INTO sales_codes (code, sales_id, country_id, prefill_current_study_level, prefill_target_level, prefill_phone, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING *`,
    [code, salesId, countryId, prefillCurrentStudyLevel, prefillTargetLevel, prefillPhone, expiresAt]
  );
  return result.rows[0];
}

// Consommation atomique : n'aboutit que si le code existe encore, n'est pas
// utilisé et n'est pas expiré — élimine toute course entre deux inscriptions
// simultanées avec le même code.
async function claim(code, studentId) {
  const result = await query(
    `UPDATE sales_codes
     SET used = true, used_by_student_id = $2, used_at = NOW(), updated_at = NOW()
     WHERE code = $1 AND used = false AND (expires_at IS NULL OR expires_at > NOW())
     RETURNING *`,
    [code, studentId]
  );
  return result.rows[0] || null;
}

module.exports = {
  findByCode,
  findBySales,
  create,
  claim
};
