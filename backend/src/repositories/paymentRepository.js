const { query } = require("../../db");

// ── Tarifs par pays ──
async function listPricing() {
  const result = await query(
    `SELECT c.id AS country_id, c.name AS country_name, c.code, c.display_order,
            cp.currency, cp.tranche1_amount, cp.tranche2_amount, cp.updated_at
     FROM countries c
     LEFT JOIN country_pricing cp ON cp.country_id = c.id
     WHERE c.active = TRUE
     ORDER BY c.display_order ASC, c.name ASC`
  );
  return result.rows;
}

async function findPricing(countryId) {
  const result = await query("SELECT * FROM country_pricing WHERE country_id = $1", [countryId]);
  return result.rows[0] || null;
}

async function upsertPricing({ countryId, currency, tranche1, tranche2, updatedBy }) {
  const result = await query(
    `INSERT INTO country_pricing (country_id, currency, tranche1_amount, tranche2_amount, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (country_id) DO UPDATE
       SET currency = $2, tranche1_amount = $3, tranche2_amount = $4, updated_by = $5, updated_at = NOW()
     RETURNING *`,
    [countryId, currency, tranche1, tranche2, updatedBy]
  );
  return result.rows[0];
}

async function removePricing(countryId) {
  await query("DELETE FROM country_pricing WHERE country_id = $1", [countryId]);
}

// ── Plans ──
const PLAN_SELECT = `
  SELECT pp.*, u.prenom AS student_prenom, u.nom AS student_nom, c.name AS country_name,
         sp.assigned_sales_id, sp.dossier_stage, su.prenom AS sales_prenom, su.nom AS sales_nom,
         COALESCE((SELECT SUM(p.amount) FROM student_payments p WHERE p.plan_id = pp.id AND p.tranche = 1 AND p.status = 'ACTIVE'), 0) AS paid1,
         COALESCE((SELECT SUM(p.amount) FROM student_payments p WHERE p.plan_id = pp.id AND p.tranche = 2 AND p.status = 'ACTIVE'), 0) AS paid2
  FROM payment_plans pp
  JOIN users u ON u.id = pp.student_id
  JOIN countries c ON c.id = pp.country_id
  LEFT JOIN student_profiles sp ON sp.user_id = pp.student_id
  LEFT JOIN users su ON su.id = sp.assigned_sales_id`;

async function listPlans() {
  const result = await query(`${PLAN_SELECT} ORDER BY pp.created_at DESC`);
  return result.rows;
}

async function listPlansForStudent(studentId) {
  const result = await query(`${PLAN_SELECT} WHERE pp.student_id = $1 ORDER BY pp.created_at ASC`, [studentId]);
  return result.rows;
}

async function findPlan(studentId, countryId) {
  const result = await query(`${PLAN_SELECT} WHERE pp.student_id = $1 AND pp.country_id = $2`, [studentId, countryId]);
  return result.rows[0] || null;
}

async function findPlanById(id) {
  const result = await query(`${PLAN_SELECT} WHERE pp.id = $1`, [id]);
  return result.rows[0] || null;
}

async function createPlan({ studentId, countryId, currency, tranche1Due, tranche2Due }) {
  const result = await query(
    `INSERT INTO payment_plans (student_id, country_id, currency, tranche1_due, tranche2_due)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (student_id, country_id) DO UPDATE SET student_id = EXCLUDED.student_id
     RETURNING *`,
    [studentId, countryId, currency, tranche1Due, tranche2Due]
  );
  return result.rows[0];
}

// ── Paiements ──
async function listPaymentsForStudent(studentId) {
  const result = await query(
    `SELECT p.*, c.name AS country_name, u.prenom AS by_prenom, u.nom AS by_nom
     FROM student_payments p
     JOIN payment_plans pp ON pp.id = p.plan_id
     JOIN countries c ON c.id = pp.country_id
     LEFT JOIN users u ON u.id = p.recorded_by
     WHERE p.student_id = $1
     ORDER BY p.created_at DESC`,
    [studentId]
  );
  return result.rows;
}

async function findPayment(id) {
  const result = await query("SELECT * FROM student_payments WHERE id = $1", [id]);
  return result.rows[0] || null;
}

// Numéro de reçu : 001-2026, 002-2026… (compteur annuel, jamais réutilisé).
async function nextReceiptNumber() {
  const year = new Date().getFullYear();
  const result = await query(
    `INSERT INTO payment_receipt_counters (year, last_number) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_number = payment_receipt_counters.last_number + 1
     RETURNING last_number`,
    [year]
  );
  return `${String(result.rows[0].last_number).padStart(3, "0")}-${year}`;
}

async function createPayment({ planId, studentId, tranche, amount, currency, method, paidAt, reference, receiptNumber, recordedBy, recordedByRole }) {
  const receipt = receiptNumber || (await nextReceiptNumber());
  const result = await query(
    `INSERT INTO student_payments (plan_id, student_id, tranche, amount, currency, method, paid_at, reference, receipt_number, recorded_by, recorded_by_role)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9, $10, $11)
     RETURNING *`,
    [planId, studentId, tranche, amount, currency, method, paidAt || null, reference || null, receipt, recordedBy || null, recordedByRole]
  );
  return result.rows[0];
}

// Un même chèque / code de virement ne doit être enregistré qu'une fois.
async function findActiveByMethodReference(method, reference) {
  const result = await query(
    `SELECT p.receipt_number FROM student_payments p
     WHERE p.status = 'ACTIVE' AND p.method = $1 AND LOWER(p.reference) = LOWER($2) LIMIT 1`,
    [method, reference]
  );
  if (result.rows[0]) return result.rows[0];
  const pending = await query(
    `SELECT payment_receipt AS receipt_number FROM sales_codes
     WHERE payment_method = $1 AND LOWER(payment_reference) = LOWER($2) LIMIT 1`,
    [method, reference]
  );
  return pending.rows[0] || null;
}

// Journal de tous les paiements (admin) : le plus récent d'abord.
async function listJournal() {
  const result = await query(
    `SELECT p.*, c.name AS country_name, u.prenom AS student_prenom, u.nom AS student_nom,
            b.prenom AS by_prenom, b.nom AS by_nom
     FROM student_payments p
     JOIN payment_plans pp ON pp.id = p.plan_id
     JOIN countries c ON c.id = pp.country_id
     JOIN users u ON u.id = p.student_id
     LEFT JOIN users b ON b.id = p.recorded_by
     ORDER BY p.created_at DESC
     LIMIT 1000`
  );
  return result.rows;
}

async function cancelPayment(id, { cancelledBy, reason }) {
  const result = await query(
    `UPDATE student_payments SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $2, cancel_reason = $3
     WHERE id = $1 AND status = 'ACTIVE' RETURNING *`,
    [id, cancelledBy, reason]
  );
  return result.rows[0] || null;
}

async function updatePaymentDate(id, paidAt) {
  const result = await query("UPDATE student_payments SET paid_at = $2 WHERE id = $1 RETURNING *", [id, paidAt]);
  return result.rows[0] || null;
}

// Encaissements actifs (totaux du tableau de bord Finance).
async function collectedTotals() {
  const result = await query(
    `SELECT currency,
            COALESCE(SUM(amount), 0) AS total,
            COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('month', CURRENT_DATE)), 0) AS month
     FROM student_payments WHERE status = 'ACTIVE' GROUP BY currency`
  );
  return result.rows;
}

// Statistiques par mois (date du paiement) : encaissements actifs, tranches, modes,
// annulations, puis ventilation par pays et par conseiller et montants facturés.
async function statsByMonth() {
  const [months, countries, sales, billed] = await Promise.all([
    query(
      `SELECT to_char(paid_at, 'YYYY-MM') AS month, currency,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE'), 0)::float AS collected,
              COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS count,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE' AND tranche = 1), 0)::float AS t1,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE' AND tranche = 2), 0)::float AS t2,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE' AND method = 'CASH'), 0)::float AS cash,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE' AND method = 'TRANSFER'), 0)::float AS transfer,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE' AND method = 'CARD'), 0)::float AS card,
              COALESCE(SUM(amount) FILTER (WHERE status = 'ACTIVE' AND method = 'CHEQUE'), 0)::float AS cheque,
              COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_count,
              COALESCE(SUM(amount) FILTER (WHERE status = 'CANCELLED'), 0)::float AS cancelled_amount
       FROM student_payments GROUP BY 1, 2 ORDER BY 1`
    ),
    query(
      `SELECT to_char(p.paid_at, 'YYYY-MM') AS month, p.currency, c.name AS name, SUM(p.amount)::float AS collected
       FROM student_payments p
       JOIN payment_plans pp ON pp.id = p.plan_id
       JOIN countries c ON c.id = pp.country_id
       WHERE p.status = 'ACTIVE' GROUP BY 1, 2, 3`
    ),
    query(
      `SELECT to_char(p.paid_at, 'YYYY-MM') AS month, p.currency,
              COALESCE(NULLIF(TRIM(CONCAT(s.prenom, ' ', s.nom)), ''), 'Sans conseiller') AS name,
              SUM(p.amount)::float AS collected
       FROM student_payments p
       LEFT JOIN student_profiles sp ON sp.user_id = p.student_id
       LEFT JOIN users s ON s.id = sp.assigned_sales_id
       WHERE p.status = 'ACTIVE' GROUP BY 1, 2, 3`
    ),
    query(
      `SELECT to_char(created_at, 'YYYY-MM') AS month, currency,
              COUNT(*)::int AS plans, SUM(tranche1_due + tranche2_due)::float AS due
       FROM payment_plans GROUP BY 1, 2`
    )
  ]);
  return { months: months.rows, countries: countries.rows, sales: sales.rows, billed: billed.rows };
}

module.exports = {
  statsByMonth,
  listPricing,
  findPricing,
  upsertPricing,
  removePricing,
  listPlans,
  listPlansForStudent,
  findPlan,
  findPlanById,
  createPlan,
  listPaymentsForStudent,
  findPayment,
  createPayment,
  nextReceiptNumber,
  findActiveByMethodReference,
  listJournal,
  cancelPayment,
  updatePaymentDate,
  collectedTotals
};
