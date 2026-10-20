const { query } = require("../../db");

const STAFF_SQL = `
  SELECT u.id, u.prenom, u.nom, u.email, u.role AS base_role, u.is_active,
         COALESCE((SELECT array_agg(ur.role ORDER BY ur.role) FROM user_roles ur WHERE ur.user_id = u.id), '{}') AS extra_roles,
         h.contract_type, h.hired_on::text AS hired_on, h.contract_ends_on::text AS contract_ends_on,
         h.cin, h.cnss_number, h.rib, h.base_salary, h.leave_days_per_month, h.cdi_from::text AS cdi_from,
         sp.job_title
  FROM users u
  LEFT JOIN hr_employees h ON h.user_id = u.id
  LEFT JOIN sales_profiles sp ON sp.user_id = u.id
  -- L'administrateur gère les employés : il n'entre pas dans l'effectif.
  WHERE (
    u.role IN ('SALES', 'RDV')
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('SALES', 'RDV'))
  )
`;

function tunisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function promoteCivp(today = tunisToday()) {
  await query(
    `UPDATE hr_employees
     SET contract_type = 'CDI',
         contract_ends_on = NULL,
         leave_days_per_month = NULL,
         cdi_from = (hired_on + INTERVAL '1 year')::date,
         updated_at = NOW()
     WHERE contract_type = 'CIVP'
       AND hired_on IS NOT NULL
       AND (hired_on + INTERVAL '1 year')::date <= $1::date`,
    [today]
  );
}

async function listStaff() {
  await promoteCivp();
  const result = await query(`${STAFF_SQL} ORDER BY u.prenom ASC, u.nom ASC`);
  return result.rows;
}

async function findStaff(userId) {
  await promoteCivp();
  const result = await query(`${STAFF_SQL} AND u.id = $1`, [userId]);
  return result.rows[0] || null;
}

async function upsertEmployee(userId, fields) {
  await query(
    `INSERT INTO hr_employees (user_id, contract_type, hired_on, contract_ends_on, cin, cnss_number, rib, base_salary, leave_days_per_month, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       contract_type = EXCLUDED.contract_type,
       hired_on = EXCLUDED.hired_on,
       contract_ends_on = EXCLUDED.contract_ends_on,
       cin = EXCLUDED.cin,
       cnss_number = EXCLUDED.cnss_number,
       rib = EXCLUDED.rib,
       base_salary = EXCLUDED.base_salary,
       leave_days_per_month = EXCLUDED.leave_days_per_month,
       updated_at = NOW()`,
    [
      userId,
      fields.contractType,
      fields.hiredOn,
      fields.contractEndsOn,
      fields.cin,
      fields.cnssNumber,
      fields.rib,
      fields.baseSalary,
      fields.leaveDaysPerMonth
    ]
  );
}

async function listHolidays() {
  const result = await query("SELECT id, day::text AS day, label, paid FROM hr_holidays ORDER BY day ASC");
  return result.rows.map((row) => ({ id: row.id, day: row.day, label: row.label, paid: row.paid !== false }));
}

async function insertHoliday(day, label, paid) {
  const result = await query(
    "INSERT INTO hr_holidays (day, label, paid) VALUES ($1, $2, $3) RETURNING id, day::text AS day, label, paid",
    [day, label, paid !== false]
  );
  const row = result.rows[0];
  return { id: row.id, day: row.day, label: row.label, paid: row.paid !== false };
}

async function deleteHoliday(id) {
  const result = await query("DELETE FROM hr_holidays WHERE id = $1", [id]);
  return result.rowCount > 0;
}

async function setHolidayPaid(id, paid) {
  const result = await query(
    "UPDATE hr_holidays SET paid = $2 WHERE id = $1 RETURNING id, day::text AS day, label, paid",
    [id, paid]
  );
  const row = result.rows[0];
  return row ? { id: row.id, day: row.day, label: row.label, paid: row.paid !== false } : null;
}

async function listLeaveRequests() {
  const result = await query(
    `SELECT id, user_id, start_on::text AS start_on, end_on::text AS end_on, days, covers_absence, reason, status, created_at
     FROM hr_leave_requests ORDER BY created_at DESC`
  );
  return result.rows;
}

async function listLeaveRequestsFor(userId) {
  const result = await query(
    `SELECT id, user_id, start_on::text AS start_on, end_on::text AS end_on, days, covers_absence, reason, status, created_at
     FROM hr_leave_requests WHERE user_id = $1 ORDER BY start_on DESC`,
    [userId]
  );
  return result.rows;
}

async function findLeaveRequest(id) {
  const result = await query(
    `SELECT id, user_id, start_on::text AS start_on, end_on::text AS end_on, days, covers_absence, reason, status
     FROM hr_leave_requests WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function insertLeaveRequest(fields) {
  const result = await query(
    `INSERT INTO hr_leave_requests (user_id, start_on, end_on, days, covers_absence, reason, status, decided_by, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [fields.userId, fields.startOn, fields.endOn, fields.days, fields.coversAbsence, fields.reason, fields.status, fields.decidedBy, fields.decidedAt]
  );
  return result.rows[0].id;
}

async function setLeaveStatus(id, status, decidedBy) {
  await query(
    "UPDATE hr_leave_requests SET status = $2, decided_by = $3, decided_at = NOW() WHERE id = $1",
    [id, status, decidedBy]
  );
}

async function hasApprovedOverlap(userId, startOn, endOn, exceptId) {
  const result = await query(
    `SELECT 1 FROM hr_leave_requests
     WHERE user_id = $1 AND status = 'APPROVED' AND start_on <= $3 AND end_on >= $2
       AND ($4::text IS NULL OR id::text <> $4)
     LIMIT 1`,
    [userId, startOn, endOn, exceptId]
  );
  return result.rowCount > 0;
}

async function listSettlements() {
  const result = await query(
    "SELECT user_id, year, action, days, amount FROM hr_leave_settlements"
  );
  return result.rows;
}

async function listEndingContracts() {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, h.contract_ends_on::text AS contract_ends_on
     FROM hr_employees h
     JOIN users u ON u.id = h.user_id
     WHERE h.contract_type = 'CDD' AND h.contract_ends_on IS NOT NULL`
  );
  return result.rows;
}

async function claimContractReminder(userId, endsOn) {
  const result = await query(
    `INSERT INTO hr_contract_reminders (user_id, contract_ends_on)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING user_id`,
    [userId, endsOn]
  );
  return result.rowCount > 0;
}

async function listLeaveAdjustments() {
  const result = await query("SELECT user_id, year, days FROM hr_leave_adjustments");
  return result.rows;
}

async function upsertLeaveAdjustment(fields) {
  await query(
    `INSERT INTO hr_leave_adjustments (user_id, year, days, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, year) DO UPDATE
       SET days = EXCLUDED.days, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [fields.userId, fields.year, fields.days, fields.updatedBy]
  );
}

async function insertSettlement(fields) {
  await query(
    `INSERT INTO hr_leave_settlements (user_id, year, action, days, amount, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [fields.userId, fields.year, fields.action, fields.days, fields.amount, fields.createdBy]
  );
}

module.exports = {
  listStaff,
  findStaff,
  promoteCivp,
  upsertEmployee,
  listHolidays,
  insertHoliday,
  deleteHoliday,
  setHolidayPaid,
  listLeaveRequests,
  listLeaveRequestsFor,
  findLeaveRequest,
  insertLeaveRequest,
  setLeaveStatus,
  hasApprovedOverlap,
  listSettlements,
  insertSettlement,
  listLeaveAdjustments,
  upsertLeaveAdjustment,
  listEndingContracts,
  claimContractReminder
};
