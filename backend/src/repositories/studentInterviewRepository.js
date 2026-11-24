const { query } = require("../../db");

const SELECT = `
  SELECT si.*, c.name AS country_name, u.prenom, u.nom, u.email
  FROM student_interviews si
  JOIN countries c ON c.id = si.country_id
  JOIN users u ON u.id = si.student_id`;

async function createIfMissing({ studentId, countryId, rdvId }) {
  const result = await query(
    `INSERT INTO student_interviews (student_id, country_id, rdv_id) VALUES ($1, $2, $3)
     ON CONFLICT (student_id, country_id) DO NOTHING RETURNING *`,
    [studentId, countryId, rdvId || null]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(`${SELECT} WHERE si.id = $1`, [id]);
  return result.rows[0] || null;
}

async function listForStudent(studentId) {
  const result = await query(`${SELECT} WHERE si.student_id = $1 ORDER BY si.created_at DESC`, [studentId]);
  return result.rows;
}

async function listForRdv(rdvId) {
  const result = await query(
    `${SELECT} WHERE (si.rdv_id = $1 OR leave_handler(si.rdv_id, si.student_id, 'RDV') = $1)
     ORDER BY (si.status = 'COMPLETED'), si.created_at ASC`,
    [rdvId]
  );
  return result.rows;
}

async function listAllPending() {
  const result = await query(`${SELECT} WHERE si.status <> 'COMPLETED' ORDER BY si.created_at ASC`);
  return result.rows;
}

async function rdvHasStudent(rdvId, studentId) {
  const result = await query(
    "SELECT 1 FROM student_interviews WHERE student_id = $2 AND (rdv_id = $1 OR leave_handler(rdv_id, student_id, 'RDV') = $1) LIMIT 1",
    [rdvId, studentId]
  );
  return result.rowCount > 0;
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const result = await query(`UPDATE student_interviews SET ${sets} WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => fields[k])]);
  return result.rows[0];
}

// Un entretien resté ouvert est clos dès qu'une université a été choisie (par le RDV ou l'admin).
async function completeOpenForStudentCountry(studentId, countryId) {
  await query(
    "UPDATE student_interviews SET status = 'COMPLETED', completed_at = NOW() WHERE student_id = $1 AND country_id = $2 AND status <> 'COMPLETED'",
    [studentId, countryId]
  );
}

module.exports = { completeOpenForStudentCountry, createIfMissing, findById, listForStudent, listForRdv, listAllPending, rdvHasStudent, update };
