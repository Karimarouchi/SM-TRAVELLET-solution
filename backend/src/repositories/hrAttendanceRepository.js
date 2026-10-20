const { query } = require("../../db");

async function record(userId, kind, at = new Date()) {
  await query("INSERT INTO hr_presence_events (user_id, kind, at) VALUES ($1, $2, $3)", [userId, kind, at]);
}

async function listEvents(from, to) {
  const result = await query(
    `SELECT user_id, kind, at FROM hr_presence_events WHERE at >= $1 AND at < $2 ORDER BY at ASC`,
    [from, to]
  );
  return result.rows;
}

async function listMessages(salesIds, from, to) {
  if (!salesIds.length) return { before: [], during: [] };
  const before = await query(
    `SELECT DISTINCT ON (c.id) c.id AS contact_id, c.assigned_sales_id AS sales_id, m.direction, m.sent_by, m.created_at AS at
     FROM whatsapp_contacts c
     JOIN whatsapp_messages m ON m.contact_id = c.id
     WHERE c.assigned_sales_id = ANY($1::uuid[])
       AND m.created_at < $2
       AND NOT (m.direction = 'out' AND m.is_auto = TRUE)
     ORDER BY c.id, m.created_at DESC`,
    [salesIds, from]
  );
  const during = await query(
    `SELECT c.id AS contact_id, c.assigned_sales_id AS sales_id, m.direction, m.is_auto, m.sent_by, m.created_at AS at
     FROM whatsapp_messages m
     JOIN whatsapp_contacts c ON c.id = m.contact_id
     WHERE c.assigned_sales_id = ANY($1::uuid[]) AND m.created_at >= $2 AND m.created_at < $3
     ORDER BY m.created_at ASC`,
    [salesIds, from, to]
  );
  return { before: before.rows, during: during.rows };
}

async function listDossierActions(from, to) {
  const result = await query(
    `SELECT changed_by AS user_id, changed_at AS at FROM application_history
     WHERE changed_by IS NOT NULL AND changed_at >= $1 AND changed_at < $2
     UNION ALL
     SELECT reviewed_by, reviewed_at FROM student_documents
     WHERE reviewed_by IS NOT NULL AND reviewed_at >= $1 AND reviewed_at < $2`,
    [from, to]
  );
  return result.rows;
}

async function listOverrides(from, to) {
  const result = await query(
    `SELECT user_id, day::text AS day, waived, late_minutes, early_minutes, note, confirmed_absent
     FROM hr_attendance_overrides WHERE day >= $1::date AND day < $2::date`,
    [from, to]
  );
  return result.rows;
}

async function listAmounts(monthStart) {
  const result = await query(
    "SELECT user_id, amount FROM hr_attendance_amounts WHERE month = $1::date",
    [monthStart]
  );
  return result.rows;
}

async function saveOverride(userId, day, fields) {
  const empty = !fields.waived && fields.lateMinutes === null && fields.earlyMinutes === null && !fields.note && !fields.confirmedAbsent;
  if (empty) {
    await query("DELETE FROM hr_attendance_overrides WHERE user_id = $1 AND day = $2", [userId, day]);
    return;
  }
  await query(
    `INSERT INTO hr_attendance_overrides (user_id, day, waived, late_minutes, early_minutes, note, confirmed_absent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, day) DO UPDATE SET
       waived = EXCLUDED.waived, late_minutes = EXCLUDED.late_minutes, early_minutes = EXCLUDED.early_minutes,
       note = EXCLUDED.note, confirmed_absent = EXCLUDED.confirmed_absent`,
    [userId, day, fields.waived, fields.lateMinutes, fields.earlyMinutes, fields.note, fields.confirmedAbsent === true]
  );
}

async function saveAmount(userId, monthStart, amount) {
  if (amount === null) {
    await query("DELETE FROM hr_attendance_amounts WHERE user_id = $1 AND month = $2::date", [userId, monthStart]);
    return;
  }
  await query(
    `INSERT INTO hr_attendance_amounts (user_id, month, amount) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, month) DO UPDATE SET amount = EXCLUDED.amount`,
    [userId, monthStart, amount]
  );
}

module.exports = {
  record,
  listEvents,
  listMessages,
  listDossierActions,
  listOverrides,
  listAmounts,
  saveOverride,
  saveAmount
};
