const { query } = require("../../db");

async function listRules() {
  const result = await query(
    `SELECT cr.*, c.name AS country_name
     FROM commission_rules cr
     JOIN countries c ON c.id = cr.country_id
     ORDER BY c.display_order ASC, cr.role ASC, cr.stage ASC`
  );
  return result.rows;
}

async function findActiveRule(countryId, role, stage) {
  const result = await query(
    `SELECT * FROM commission_rules WHERE country_id = $1 AND role = $2 AND stage = $3 AND active = TRUE`,
    [countryId, role, stage]
  );
  return result.rows[0] || null;
}

async function upsertRule({ countryId, role, stage, amountDinar }) {
  const result = await query(
    `INSERT INTO commission_rules (country_id, role, stage, amount_dinar, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (country_id, role, stage)
     DO UPDATE SET amount_dinar = $4, active = TRUE, updated_at = NOW()
     RETURNING *`,
    [countryId, role, stage, amountDinar]
  );
  return result.rows[0];
}

async function setRuleActive(id, active) {
  const result = await query(
    `UPDATE commission_rules SET active = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, active]
  );
  return result.rows[0] || null;
}

async function removeRule(id) {
  const result = await query(`DELETE FROM commission_rules WHERE id = $1 RETURNING id`, [id]);
  return (result.rowCount ?? 0) > 0;
}

// Idempotent : si (user, student, country, stage) existe déjà, ne fait rien
// (contrainte UNIQUE) — c'est ce qui empêche de payer deux fois la même
// étape pour le même étudiant, même après un refus + nouvelle candidature.
async function recordEarning({ ruleId, userId, studentId, applicationId, countryId, role, stage, amountDinar }) {
  const result = await query(
    `INSERT INTO commission_earnings (rule_id, user_id, student_id, application_id, country_id, role, stage, amount_dinar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, student_id, country_id, stage) DO NOTHING
     RETURNING *`,
    [ruleId, userId, studentId, applicationId || null, countryId, role, stage, amountDinar]
  );
  return result.rows[0] || null;
}

async function listAllEarnings() {
  const result = await query(
    `SELECT ce.*, c.name AS country_name,
            u.prenom AS user_prenom, u.nom AS user_nom, u.email AS user_email,
            s.prenom AS student_prenom, s.nom AS student_nom
     FROM commission_earnings ce
     JOIN countries c ON c.id = ce.country_id
     JOIN users u ON u.id = ce.user_id
     JOIN users s ON s.id = ce.student_id
     ORDER BY ce.earned_at DESC`
  );
  return result.rows;
}

async function listEarningsForUser(userId) {
  const result = await query(
    `SELECT ce.*, c.name AS country_name, s.prenom AS student_prenom, s.nom AS student_nom
     FROM commission_earnings ce
     JOIN countries c ON c.id = ce.country_id
     JOIN users s ON s.id = ce.student_id
     WHERE ce.user_id = $1
     ORDER BY ce.earned_at DESC`,
    [userId]
  );
  return result.rows;
}

module.exports = {
  listRules,
  findActiveRule,
  upsertRule,
  setRuleActive,
  removeRule,
  recordEarning,
  listAllEarnings,
  listEarningsForUser
};
