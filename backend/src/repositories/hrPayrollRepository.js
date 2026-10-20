const { query } = require("../../db");

async function paidCommissions(from, to, timeZone, monthStart) {
  const result = await query(
    `SELECT e.id, e.user_id, e.amount_dinar, e.stage, e.earned_at, p.paid_at,
            s.prenom AS student_prenom, s.nom AS student_nom,
            (timezone($3, p.paid_at) >= $1::timestamp AND timezone($3, p.paid_at) < $2::timestamp) AS paid_this_month,
            (timezone($3, e.earned_at) >= $1::timestamp AND timezone($3, e.earned_at) < $2::timestamp) AS earned_this_month,
            inc.month::text AS included_month
     FROM commission_earnings e
     JOIN commission_payouts p ON p.id = e.payout_id
     JOIN users s ON s.id = e.student_id
     LEFT JOIN hr_payroll_included_commissions inc ON inc.earning_id = e.id
     WHERE e.payout_id IS NOT NULL
       AND (
         (timezone($3, p.paid_at) >= $1::timestamp AND timezone($3, p.paid_at) < $2::timestamp)
         OR (timezone($3, e.earned_at) >= $1::timestamp AND timezone($3, e.earned_at) < $2::timestamp)
         OR (timezone($3, p.paid_at) < $2::timestamp AND inc.month IS NULL)
         OR inc.month = $4::date
       )
     ORDER BY p.paid_at DESC`,
    [from, to, timeZone, monthStart]
  );
  return result.rows;
}

async function findCommissionEarning(id) {
  const result = await query(
    `SELECT id, user_id, payout_id FROM commission_earnings WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function includeCommission(userId, monthStart, earningId) {
  await query(
    `INSERT INTO hr_payroll_included_commissions (earning_id, user_id, month)
     VALUES ($1, $2, $3::date)
     ON CONFLICT (earning_id) DO UPDATE SET user_id = EXCLUDED.user_id, month = EXCLUDED.month`,
    [earningId, userId, monthStart]
  );
}

async function excludeCommission(userId, monthStart, earningId) {
  await query(
    `DELETE FROM hr_payroll_included_commissions WHERE earning_id = $1 AND user_id = $2 AND month = $3::date`,
    [earningId, userId, monthStart]
  );
}

async function unpaidCommissionsByUser(to, timeZone) {
  const result = await query(
    `SELECT user_id, COALESCE(SUM(amount_dinar), 0) AS total
     FROM commission_earnings
     WHERE payout_id IS NULL
       AND timezone($2, earned_at) < $1::timestamp
       AND NOT EXISTS (
         SELECT 1 FROM hr_payroll_reported_commissions r WHERE r.earning_id = commission_earnings.id
       )
     GROUP BY user_id`,
    [to, timeZone]
  );
  return result.rows;
}

async function reportUnpaidCommissions(userId, to, timeZone, monthStart) {
  await query(
    `INSERT INTO hr_payroll_reported_commissions (earning_id, user_id, month)
     SELECT id, user_id, $4::date
     FROM commission_earnings
     WHERE user_id = $1
       AND payout_id IS NULL
       AND timezone($3, earned_at) < $2::timestamp
       AND NOT EXISTS (
         SELECT 1 FROM hr_payroll_reported_commissions r WHERE r.earning_id = commission_earnings.id
       )`,
    [userId, to, timeZone, monthStart]
  );
}

async function clearReportedCommissions(userId, monthStart) {
  await query(
    "DELETE FROM hr_payroll_reported_commissions WHERE user_id = $1 AND month = $2::date",
    [userId, monthStart]
  );
}

async function commissionsByUser(from, to, timeZone) {
  const result = await query(
    `SELECT user_id, COALESCE(SUM(amount_dinar), 0) AS total
     FROM commission_earnings
     WHERE timezone($3, earned_at) >= $1::timestamp AND timezone($3, earned_at) < $2::timestamp
     GROUP BY user_id`,
    [from, to, timeZone]
  );
  return result.rows;
}

async function paidLeaveByUser(from, to, timeZone) {
  const result = await query(
    `SELECT user_id, COALESCE(SUM(amount), 0) AS total
     FROM hr_leave_settlements
     WHERE action = 'PAY'
       AND timezone($3, created_at) >= $1::timestamp AND timezone($3, created_at) < $2::timestamp
     GROUP BY user_id`,
    [from, to, timeZone]
  );
  return result.rows;
}

async function listAdjustments(monthStart) {
  const result = await query(
    "SELECT user_id, bonus, advance, note FROM hr_payroll_adjustments WHERE month = $1::date",
    [monthStart]
  );
  return result.rows;
}

async function saveAdjustment(userId, monthStart, fields) {
  await query(
    `INSERT INTO hr_payroll_adjustments (user_id, month, bonus, advance, note)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, month) DO UPDATE SET bonus = EXCLUDED.bonus, advance = EXCLUDED.advance, note = EXCLUDED.note`,
    [userId, monthStart, fields.bonus, fields.advance, fields.note]
  );
}

async function listPayslips(monthStart) {
  const result = await query(
    `SELECT id, user_id, month::text AS month, base_salary, commissions, included_commissions, bonus, paid_leave,
            absence_deduction, lateness_deduction, presence_adjustment, advance, net, note, issued_at, advance_balance, unpaid_holiday_deduction
     FROM hr_payslips WHERE month = $1::date`,
    [monthStart]
  );
  return result.rows;
}

async function findPayslip(userId, monthStart) {
  const result = await query(
    `SELECT id, user_id, month::text AS month, base_salary, commissions, included_commissions, bonus, paid_leave,
            absence_deduction, lateness_deduction, presence_adjustment, advance, net, note, issued_at, advance_balance, unpaid_holiday_deduction
     FROM hr_payslips WHERE user_id = $1 AND month = $2::date`,
    [userId, monthStart]
  );
  return result.rows[0] || null;
}

async function listPayslipsFor(userId) {
  const result = await query(
    `SELECT month::text AS month, net, issued_at
     FROM hr_payslips WHERE user_id = $1 ORDER BY month DESC`,
    [userId]
  );
  return result.rows;
}

async function listPayslipHistory(userId) {
  const result = await query(
    `SELECT month::text AS month, base_salary, commissions, bonus, paid_leave, absence_deduction,
            lateness_deduction, unpaid_holiday_deduction, advance, net, issued_at
     FROM hr_payslips WHERE user_id = $1 ORDER BY month DESC`,
    [userId]
  );
  return result.rows;
}

async function commissionTotals(userId) {
  const result = await query(
    `SELECT COALESCE(SUM(amount_dinar), 0) AS total,
            COALESCE(SUM(amount_dinar) FILTER (WHERE payout_id IS NOT NULL), 0) AS paid
     FROM commission_earnings WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

async function listCommissionsFor(userId) {
  const result = await query(
    `SELECT e.id, e.amount_dinar, e.earned_at, e.stage, e.payout_id IS NOT NULL AS paid,
            s.prenom AS student_prenom, s.nom AS student_nom, c.name AS country
     FROM commission_earnings e
     JOIN users s ON s.id = e.student_id
     LEFT JOIN countries c ON c.id = e.country_id
     WHERE e.user_id = $1
     ORDER BY e.earned_at DESC
     LIMIT 80`,
    [userId]
  );
  return result.rows;
}

async function insertPayslip(fields) {
  const result = await query(
    `INSERT INTO hr_payslips (
       user_id, month, base_salary, commissions, included_commissions, bonus, paid_leave, absence_deduction,
       lateness_deduction, presence_adjustment, advance, net, note, issued_by, advance_balance, unpaid_holiday_deduction
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      fields.userId, fields.month, fields.baseSalary, fields.commissions, fields.includedCommissions || 0, fields.bonus, fields.paidLeave,
      fields.absenceDeduction, fields.latenessDeduction, fields.presenceAdjustment, fields.advance,
      fields.net, fields.note, fields.issuedBy, fields.advanceBalance, fields.unpaidHolidayDeduction
    ]
  );
  return result.rows[0].id;
}

async function deletePayslip(userId, monthStart) {
  await query("DELETE FROM hr_payslips WHERE user_id = $1 AND month = $2::date", [userId, monthStart]);
}

async function listEntries() {
  const result = await query(
    "SELECT id, user_id, month::text AS month, kind, label, amount FROM hr_payroll_entries ORDER BY month ASC, created_at ASC"
  );
  return result.rows;
}

async function insertEntry(fields) {
  const result = await query(
    `INSERT INTO hr_payroll_entries (user_id, month, kind, label, amount)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, month::text AS month, kind, label, amount`,
    [fields.userId, fields.month, fields.kind, fields.label, fields.amount]
  );
  return result.rows[0];
}

async function findEntry(id) {
  const result = await query("SELECT id, user_id, month::text AS month, kind, label, amount FROM hr_payroll_entries WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function deleteEntry(id) {
  await query("DELETE FROM hr_payroll_entries WHERE id = $1", [id]);
}

async function listDocuments(userId) {
  const result = await query(
    `SELECT id, label, original_filename, mime_type, created_at, kind
     FROM hr_employee_documents WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function listDocumentsForUsers(userIds) {
  if (!userIds.length) return [];
  const result = await query(
    `SELECT id, user_id, label, original_filename, created_at
     FROM hr_employee_documents WHERE user_id = ANY($1::uuid[]) ORDER BY created_at DESC`,
    [userIds]
  );
  return result.rows;
}

async function findDocumentByKind(userId, kind) {
  const result = await query(
    "SELECT id, stored_filename FROM hr_employee_documents WHERE user_id = $1 AND kind = $2",
    [userId, kind]
  );
  return result.rows[0] || null;
}

async function insertDocument(fields) {
  const result = await query(
    `INSERT INTO hr_employee_documents (user_id, label, stored_filename, original_filename, mime_type, kind)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, label, original_filename, created_at, kind`,
    [fields.userId, fields.label, fields.storedFilename, fields.originalFilename, fields.mimeType, fields.kind || "OTHER"]
  );
  return result.rows[0];
}

async function findDocument(id) {
  const result = await query(
    "SELECT id, user_id, label, stored_filename, original_filename, mime_type FROM hr_employee_documents WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

async function deleteDocument(id) {
  const result = await query("DELETE FROM hr_employee_documents WHERE id = $1 RETURNING stored_filename", [id]);
  return result.rows[0] || null;
}

async function listDocumentRequests(userId) {
  const result = await query(
    `SELECT id, kind, month::text AS month, status, ready_on::text AS ready_on, created_at
     FROM hr_document_requests WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function listPendingDocumentRequests() {
  const result = await query(
    `SELECT r.id, r.user_id, r.kind, r.month::text AS month, r.ready_on::text AS ready_on, r.created_at, u.prenom, u.nom,
            (EXISTS (SELECT 1 FROM hr_payslips p WHERE p.user_id = r.user_id AND p.month = r.month)
             OR EXISTS (SELECT 1 FROM hr_official_payslips o WHERE o.user_id = r.user_id AND o.month = r.month)) AS has_fiche
     FROM hr_document_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.status = 'PENDING'
     ORDER BY r.created_at ASC`
  );
  return result.rows;
}

async function findDocumentRequestById(id) {
  const result = await query(
    `SELECT id, user_id, kind, month::text AS month, status, ready_on::text AS ready_on
     FROM hr_document_requests WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function scheduleDocumentRequest(id, readyOn) {
  const result = await query(
    `UPDATE hr_document_requests
     SET ready_on = $2::date, reminded_at = NULL
     WHERE id = $1 AND status = 'PENDING' AND kind = 'PAYSLIP'
     RETURNING id, user_id, kind, month::text AS month, status, ready_on::text AS ready_on`,
    [id, readyOn]
  );
  return result.rows[0] || null;
}

async function listDuePayslipRequests(today) {
  const result = await query(
    `SELECT r.id, r.user_id, r.month::text AS month, u.prenom, u.nom,
            (EXISTS (SELECT 1 FROM hr_payslips p WHERE p.user_id = r.user_id AND p.month = r.month)
             OR EXISTS (SELECT 1 FROM hr_official_payslips o WHERE o.user_id = r.user_id AND o.month = r.month)) AS has_fiche
     FROM hr_document_requests r
     JOIN users u ON u.id = r.user_id
     WHERE r.kind = 'PAYSLIP' AND r.status = 'PENDING' AND r.ready_on <= $1::date AND r.reminded_at IS NULL`,
    [today]
  );
  return result.rows;
}

async function markPayslipReminded(id) {
  await query(`UPDATE hr_document_requests SET reminded_at = NOW() WHERE id = $1 AND reminded_at IS NULL`, [id]);
}

async function findDocumentRequest(userId, kind, month) {
  const result = await query(
    `SELECT id, status FROM hr_document_requests
     WHERE user_id = $1 AND kind = $2 AND month IS NOT DISTINCT FROM $3::date
     ORDER BY created_at DESC LIMIT 1`,
    [userId, kind, month]
  );
  return result.rows[0] || null;
}

async function insertDocumentRequest(userId, kind, month) {
  const result = await query(
    `INSERT INTO hr_document_requests (user_id, kind, month)
     VALUES ($1, $2, $3::date)
     RETURNING id, kind, month::text AS month, status`,
    [userId, kind, month]
  );
  return result.rows[0];
}

async function decideDocumentRequest(id, status, decidedBy) {
  const result = await query(
    `UPDATE hr_document_requests
     SET status = $2, decided_at = NOW(), decided_by = $3
     WHERE id = $1 AND status = 'PENDING'
     RETURNING id, user_id, kind, month::text AS month, status`,
    [id, status, decidedBy]
  );
  return result.rows[0] || null;
}

async function listOfficialMonths() {
  const result = await query(
    `SELECT user_id, to_char(month, 'YYYY-MM') AS month FROM hr_official_payslips ORDER BY month`
  );
  return result.rows;
}

async function listOfficialForMonth(month) {
  const result = await query(
    `SELECT id, user_id, month::text AS month, employee_name, matricule, cnss_number,
            base_salary, presence_days, presence_rate, presence_amount, leave_days, leave_rate, leave_amount,
            transport, presence_bonus, function_allowance, responsibility_bonus, gross, cnss, taxable, irpp, css,
            net, net_to_pay, stored_filename, original_filename, confirmed_at
     FROM hr_official_payslips WHERE month = $1`,
    [month]
  );
  return result.rows;
}

async function listOfficialForUser(userId) {
  const result = await query(
    `SELECT id, user_id, month::text AS month, employee_name, matricule, cnss_number,
            base_salary, presence_days, presence_amount, leave_days, leave_amount, transport, presence_bonus, function_allowance, responsibility_bonus,
            gross, cnss, taxable, irpp, css, net, net_to_pay, stored_filename, original_filename, confirmed_at
     FROM hr_official_payslips WHERE user_id = $1 ORDER BY month DESC`,
    [userId]
  );
  return result.rows;
}

async function findOfficial(userId, month) {
  const result = await query(
    `SELECT id, user_id, month::text AS month, employee_name, matricule, cnss_number,
            base_salary, presence_days, presence_amount, leave_days, leave_amount,
            transport, presence_bonus, function_allowance, responsibility_bonus,
            gross, cnss, taxable, irpp, css, net, net_to_pay, stored_filename, original_filename
     FROM hr_official_payslips WHERE user_id = $1 AND month = $2`,
    [userId, month]
  );
  return result.rows[0] || null;
}

async function upsertOfficial(row) {
  const result = await query(
    `INSERT INTO hr_official_payslips (
       user_id, month, employee_name, matricule, cnss_number, base_salary,
       presence_days, presence_rate, presence_amount, leave_days, leave_rate, leave_amount,
       transport, presence_bonus, function_allowance, responsibility_bonus, gross, cnss, taxable, irpp, css,
       net, net_to_pay, stored_filename, original_filename, confirmed_by
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, $18, $19, $20, $21,
       $22, $23, $24, $25, $26
     )
     ON CONFLICT (user_id, month) DO UPDATE SET
       employee_name = EXCLUDED.employee_name,
       matricule = EXCLUDED.matricule,
       cnss_number = EXCLUDED.cnss_number,
       base_salary = EXCLUDED.base_salary,
       presence_days = EXCLUDED.presence_days,
       presence_rate = EXCLUDED.presence_rate,
       presence_amount = EXCLUDED.presence_amount,
       leave_days = EXCLUDED.leave_days,
       leave_rate = EXCLUDED.leave_rate,
       leave_amount = EXCLUDED.leave_amount,
       transport = EXCLUDED.transport,
       presence_bonus = EXCLUDED.presence_bonus,
       function_allowance = EXCLUDED.function_allowance,
       responsibility_bonus = EXCLUDED.responsibility_bonus,
       gross = EXCLUDED.gross,
       cnss = EXCLUDED.cnss,
       taxable = EXCLUDED.taxable,
       irpp = EXCLUDED.irpp,
       css = EXCLUDED.css,
       net = EXCLUDED.net,
       net_to_pay = EXCLUDED.net_to_pay,
       stored_filename = EXCLUDED.stored_filename,
       original_filename = EXCLUDED.original_filename,
       confirmed_by = EXCLUDED.confirmed_by,
       confirmed_at = NOW()
     RETURNING id, month::text AS month`,
    [
      row.userId, row.month, row.employeeName, row.matricule, row.cnss, row.baseSalary,
      row.presenceDays, row.presenceRate, row.presenceAmount, row.leaveDays, row.leaveRate, row.leaveAmount,
      row.transport, row.presenceBonus, row.functionAllowance, row.responsibilityBonus, row.gross, row.cnssDeduction, row.taxable, row.irpp, row.css,
      row.net, row.netToPay, row.storedFilename, row.originalFilename, row.confirmedBy
    ]
  );
  return result.rows[0];
}

async function deleteOfficial(userId, month) {
  const result = await query(
    "DELETE FROM hr_official_payslips WHERE user_id = $1 AND month = $2 RETURNING stored_filename",
    [userId, month]
  );
  return result.rows[0] || null;
}

module.exports = {
  commissionsByUser,
  unpaidCommissionsByUser,
  reportUnpaidCommissions,
  clearReportedCommissions,
  paidCommissions,
  findCommissionEarning,
  includeCommission,
  excludeCommission,
  paidLeaveByUser,
  listAdjustments,
  saveAdjustment,
  listPayslips,
  findPayslip,
  listPayslipsFor,
  listPayslipHistory,
  commissionTotals,
  listCommissionsFor,
  insertPayslip,
  deletePayslip,
  listOfficialMonths,
  listOfficialForMonth,
  listOfficialForUser,
  findOfficial,
  upsertOfficial,
  deleteOfficial,
  listDocuments,
  listDocumentsForUsers,
  findDocumentByKind,
  insertDocument,
  findDocument,
  deleteDocument,
  listDocumentRequests,
  listPendingDocumentRequests,
  findDocumentRequest,
  findDocumentRequestById,
  insertDocumentRequest,
  decideDocumentRequest,
  scheduleDocumentRequest,
  listDuePayslipRequests,
  markPayslipReminded,
  listEntries,
  insertEntry,
  findEntry,
  deleteEntry
};
