const { query } = require("../../db");

const NIL = "00000000-0000-0000-0000-000000000000";

async function listForStudent(studentId) {
  const result = await query("SELECT * FROM student_translations WHERE student_id = $1 ORDER BY requested_at ASC", [studentId]);
  return result.rows;
}

async function findById(id) {
  const result = await query("SELECT * FROM student_translations WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function create({ studentId, docName, universityId, requestedBy }) {
  const result = await query(
    `INSERT INTO student_translations (student_id, doc_name, university_id, requested_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, doc_name, COALESCE(university_id, '${NIL}'::uuid)) DO NOTHING
     RETURNING *`,
    [studentId, docName, universityId || null, requestedBy]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  await query("DELETE FROM student_translations WHERE id = $1", [id]);
}

async function setFile(id, { fileUrl, originalFilename, storedFilename, mimeType, fileSize, status, reviewedBy }) {
  const result = await query(
    `UPDATE student_translations
     SET file_url = $2, original_filename = $3, stored_filename = $4, mime_type = $5, file_size = $6,
         status = $7::varchar, submitted_at = NOW(), reviewed_by = $8, reviewed_at = CASE WHEN $7::varchar = 'VALIDATED' THEN NOW() ELSE NULL END,
         rejection_reason = NULL
     WHERE id = $1 RETURNING *`,
    [id, fileUrl, originalFilename, storedFilename, mimeType, fileSize, status, reviewedBy || null]
  );
  return result.rows[0] || null;
}

async function review(id, { status, reviewedBy, reason }) {
  const result = await query(
    `UPDATE student_translations SET status = $2, reviewed_by = $3, reviewed_at = NOW(), rejection_reason = $4
     WHERE id = $1 RETURNING *`,
    [id, status, reviewedBy, reason || null]
  );
  return result.rows[0] || null;
}

// Noms des documents dont la traduction demandée n'est pas encore validée (bloque le dépôt de candidature).
async function pendingNames(studentId) {
  const result = await query(
    "SELECT doc_name FROM student_translations WHERE student_id = $1 AND status <> 'VALIDATED' ORDER BY requested_at",
    [studentId]
  );
  return result.rows.map((r) => r.doc_name);
}

module.exports = { listForStudent, findById, create, remove, setFile, review, pendingNames };
