const { query } = require("../../db");

async function listBetween(fromDay, toDay) {
  const result = await query(
    `SELECT user_id, day::text AS day, stored_filename, original_filename, mime_type, submitted_at, submitted_by, accepted
     FROM hr_absence_certificates WHERE day >= $1::date AND day < $2::date`,
    [fromDay, toDay]
  );
  return result.rows;
}

async function find(userId, day) {
  const result = await query(
    `SELECT user_id, day::text AS day, stored_filename, original_filename, mime_type, submitted_at, submitted_by, accepted
     FROM hr_absence_certificates WHERE user_id = $1 AND day = $2::date`,
    [userId, day]
  );
  return result.rows[0] || null;
}

async function save(fields) {
  await query(
    `INSERT INTO hr_absence_certificates (user_id, day, stored_filename, original_filename, mime_type, submitted_at, submitted_by, accepted)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id, day) DO UPDATE SET
       stored_filename = EXCLUDED.stored_filename,
       original_filename = EXCLUDED.original_filename,
       mime_type = EXCLUDED.mime_type,
       submitted_at = EXCLUDED.submitted_at,
       submitted_by = EXCLUDED.submitted_by,
       accepted = EXCLUDED.accepted`,
    [fields.userId, fields.day, fields.storedFilename, fields.originalFilename, fields.mimeType, fields.submittedAt, fields.submittedBy, fields.accepted]
  );
}

async function accept(userId, day) {
  const result = await query(
    "UPDATE hr_absence_certificates SET accepted = TRUE WHERE user_id = $1 AND day = $2::date RETURNING user_id",
    [userId, day]
  );
  return result.rowCount > 0;
}

async function reminderExists(userId, day) {
  const result = await query("SELECT 1 FROM hr_absence_reminders WHERE user_id = $1 AND day = $2::date", [userId, day]);
  return result.rowCount > 0;
}

async function markReminded(userId, day) {
  await query(
    "INSERT INTO hr_absence_reminders (user_id, day) VALUES ($1, $2) ON CONFLICT (user_id, day) DO NOTHING",
    [userId, day]
  );
}

module.exports = { listBetween, find, save, accept, reminderExists, markReminded };
