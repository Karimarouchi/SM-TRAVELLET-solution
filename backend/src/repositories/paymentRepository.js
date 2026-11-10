const { query, transaction } = require("../../db");

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

async function listLevelPricing() {
  const result = await query("SELECT * FROM level_pricing");
  return result.rows;
}

async function findLevelPricing(countryId, levelId) {
  const result = await query("SELECT * FROM level_pricing WHERE country_id = $1 AND level_id = $2", [countryId, levelId]);
  return result.rows[0] || null;
}

async function upsertLevelPricing({ countryId, levelId, currency, tranche1, tranche2, updatedBy }) {
  const result = await query(
    `INSERT INTO level_pricing (country_id, level_id, currency, tranche1_amount, tranche2_amount, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (country_id, level_id) DO UPDATE
       SET currency = $3, tranche1_amount = $4, tranche2_amount = $5, updated_by = $6, updated_at = NOW()
     RETURNING *`,
    [countryId, levelId, currency, tranche1, tranche2, updatedBy]
  );
  return result.rows[0];
}

async function removeLevelPricing(countryId, levelId) {
  await query("DELETE FROM level_pricing WHERE country_id = $1 AND level_id = $2", [countryId, levelId]);
}

// ── Plans ──
const PLAN_SELECT = `
  SELECT pp.*, u.prenom AS student_prenom, u.nom AS student_nom, c.name AS country_name,
         sp.assigned_sales_id, sp.dossier_stage, su.prenom AS sales_prenom, su.nom AS sales_nom,
         COALESCE((SELECT SUM(p.amount) FROM student_payments p WHERE p.plan_id = pp.id AND p.tranche = 1 AND p.status = 'ACTIVE'), 0) AS paid1,
         COALESCE((SELECT SUM(p.amount) FROM student_payments p WHERE p.plan_id = pp.id AND p.tranche = 2 AND p.status = 'ACTIVE'), 0) AS paid2,
         EXISTS (SELECT 1 FROM university_applications ua WHERE ua.student_id = pp.student_id AND ua.country_id = pp.country_id AND ua.status = 'ACCEPTED') AS university_accepted
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

// tranche1Due / tranche2Due : montants À PAYER (nets de remise) ; tranche1Discount : remise déjà
// accordée sur la tranche 1 (création du code), le prix catalogue = montant dû + remise.
async function createPlan({ studentId, countryId, currency, tranche1Due, tranche2Due, tranche1Deadline = null, levelId = null, levelName = null, tranche1Discount = 0 }) {
  const result = await query(
    `INSERT INTO payment_plans (student_id, country_id, currency, tranche1_due, tranche2_due, tranche1_deadline, level_id, level_name,
                                tranche1_base, tranche2_base, tranche1_discount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $4::numeric + $9::numeric, $5::numeric, $9::numeric)
     ON CONFLICT (student_id, country_id) DO UPDATE SET student_id = EXCLUDED.student_id
     RETURNING *`,
    [studentId, countryId, currency, tranche1Due, tranche2Due, tranche1Deadline, levelId, levelName, tranche1Discount || 0]
  );
  return result.rows[0];
}

// Le conseiller change le pays ou le niveau : les montants dus suivent le nouveau
// tarif. Les paiements déjà enregistrés restent attachés à ce plan.
async function retargetPlan(planId, { countryId, currency, tranche1Due, tranche2Due, levelId, levelName }) {
  const result = await query(
    `UPDATE payment_plans
     SET country_id = $2, currency = $3, level_id = $6, level_name = $7,
         tranche1_base = $4::numeric, tranche2_base = $5::numeric,
         tranche1_due = GREATEST($4::numeric - tranche1_discount, 0), tranche2_due = GREATEST($5::numeric - tranche2_discount, 0)
     WHERE id = $1
     RETURNING *`,
    [planId, countryId, currency, tranche1Due, tranche2Due, levelId, levelName]
  );
  return result.rows[0] || null;
}

// Date limite promise à l'étudiant pour payer le reste d'une tranche (null = plus de reste).
async function setPlanDeadline(planId, tranche, deadline) {
  const column = Number(tranche) === 1 ? "tranche1_deadline" : "tranche2_deadline";
  await query(`UPDATE payment_plans SET ${column} = $2 WHERE id = $1`, [planId, deadline]);
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

// ── Remises ──
const DISCOUNT_SELECT = `
  SELECT d.*, u.prenom AS by_prenom, u.nom AS by_nom, cu.prenom AS cancelled_prenom, cu.nom AS cancelled_nom
  FROM payment_discounts d
  LEFT JOIN users u ON u.id = d.created_by
  LEFT JOIN users cu ON cu.id = d.cancelled_by`;

async function listDiscountsForStudent(studentId) {
  const result = await query(
    `${DISCOUNT_SELECT}
     JOIN payment_plans pp ON pp.id = d.plan_id
     WHERE pp.student_id = $1
     ORDER BY d.created_at DESC`,
    [studentId]
  );
  return result.rows;
}

async function listActiveDiscounts(planId) {
  const result = await query("SELECT * FROM payment_discounts WHERE plan_id = $1 AND status = 'ACTIVE'", [planId]);
  return result.rows;
}

async function findDiscount(id) {
  const result = await query("SELECT * FROM payment_discounts WHERE id = $1", [id]);
  return result.rows[0] || null;
}

// Fixe la remise de la tranche et le montant à payer qui en découle (prix catalogue − remise).
// Colonnes issues d'une liste fermée : jamais de texte libre dans la requête.
async function writeTrancheDiscount(client, planId, tranche, amount) {
  const n = Number(tranche) === 1 ? 1 : 2;
  await client.query(
    `UPDATE payment_plans SET tranche${n}_discount = $2::numeric, tranche${n}_due = GREATEST(tranche${n}_base - $2::numeric, 0) WHERE id = $1`,
    [planId, amount]
  );
}

// Nouvelle remise : l'éventuelle remise active de la tranche est annulée (elle reste dans l'historique).
async function replaceDiscount({ planId, tranche, kind, value, amount, reason, createdBy, createdByRole }) {
  return transaction(async (client) => {
    await client.query(
      `UPDATE payment_discounts SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $3, cancel_reason = 'Remplacée par une nouvelle remise'
       WHERE plan_id = $1 AND tranche = $2 AND status = 'ACTIVE'`,
      [planId, tranche, createdBy || null]
    );
    const inserted = await client.query(
      `INSERT INTO payment_discounts (plan_id, tranche, kind, value, amount, reason, created_by, created_by_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [planId, tranche, kind, value, amount, reason || null, createdBy || null, createdByRole]
    );
    await writeTrancheDiscount(client, planId, tranche, amount);
    return inserted.rows[0];
  });
}

async function cancelDiscount(id, { cancelledBy, reason }) {
  return transaction(async (client) => {
    const result = await client.query(
      `UPDATE payment_discounts SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $2, cancel_reason = $3
       WHERE id = $1 AND status = 'ACTIVE' RETURNING *`,
      [id, cancelledBy || null, reason]
    );
    const row = result.rows[0];
    if (!row) return null;
    await writeTrancheDiscount(client, row.plan_id, row.tranche, 0);
    return row;
  });
}

// Le prix catalogue a changé (pays ou niveau modifié) : une remise en pourcentage suit le nouveau prix.
async function updateDiscountAmount(discount, amount) {
  return transaction(async (client) => {
    await client.query("UPDATE payment_discounts SET amount = $2 WHERE id = $1", [discount.id, amount]);
    await writeTrancheDiscount(client, discount.plan_id, discount.tranche, amount);
  });
}

async function insertDiscountRecord({ planId, tranche, kind, value, amount, reason, createdBy, createdByRole }) {
  const result = await query(
    `INSERT INTO payment_discounts (plan_id, tranche, kind, value, amount, reason, created_by, created_by_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [planId, tranche, kind, value, amount, reason || null, createdBy || null, createdByRole]
  );
  return result.rows[0];
}

module.exports = {
  listDiscountsForStudent,
  listActiveDiscounts,
  findDiscount,
  replaceDiscount,
  cancelDiscount,
  updateDiscountAmount,
  insertDiscountRecord,
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
  retargetPlan,
  listLevelPricing,
  findLevelPricing,
  upsertLevelPricing,
  removeLevelPricing,
  listPaymentsForStudent,
  findPayment,
  createPayment,
  nextReceiptNumber,
  findActiveByMethodReference,
  listJournal,
  cancelPayment,
  setPlanDeadline,
  updatePaymentDate,
  collectedTotals
};
