const { query } = require("../../db");

async function findById(id) {
  const result = await query("SELECT * FROM university_applications WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function listForStudent(studentId) {
  const result = await query(
    `SELECT ua.*, c.name AS country_name, cu.name AS university_name, p.title AS programme_title
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     LEFT JOIN programmes p ON p.id = ua.programme_id
     WHERE ua.student_id = $1
     ORDER BY ua.created_at DESC`,
    [studentId]
  );
  return result.rows;
}

async function findActiveForStudent(studentId) {
  // "Active" = pas encore clôturée ni refusée sans suite (REJECTED reste
  // visible tant que le Sales n'a pas explicitement CLOSED ou réouvert).
  const result = await query(
    `SELECT ua.*, c.name AS country_name, cu.name AS university_name, p.title AS programme_title
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     LEFT JOIN programmes p ON p.id = ua.programme_id
     WHERE ua.student_id = $1 AND ua.status NOT IN ('CLOSED')
     ORDER BY ua.created_at DESC`,
    [studentId]
  );
  return result.rows;
}

async function create({ studentId, countryId, universityId, programmeId, salesId }) {
  const result = await query(
    `INSERT INTO university_applications (student_id, country_id, university_id, programme_id, sales_id, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'READY_TO_APPLY', NOW())
     RETURNING *`,
    [studentId, countryId, universityId, programmeId || null, salesId || null]
  );
  return result.rows[0];
}

async function update(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return findById(id);
  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const result = await query(
    `UPDATE university_applications SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...keys.map((k) => fields[k])]
  );
  return result.rows[0] || null;
}

async function listForRdv(rdvUserId) {
  const result = await query(
    `SELECT ua.*, c.name AS country_name, cu.name AS university_name, p.title AS programme_title,
            u.prenom AS student_prenom, u.nom AS student_nom, u.email AS student_email
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     JOIN users u ON u.id = ua.student_id
     LEFT JOIN programmes p ON p.id = ua.programme_id
     WHERE ua.assigned_rdv_id = $1
     ORDER BY ua.updated_at DESC`,
    [rdvUserId]
  );
  return result.rows;
}

async function countActiveForRdv(rdvUserId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM university_applications
     WHERE assigned_rdv_id = $1 AND status NOT IN ('CLOSED', 'REJECTED')`,
    [rdvUserId]
  );
  return result.rows[0].count;
}

async function addHistory({ applicationId, studentId, oldStatus, newStatus, changedBy, comment }) {
  const result = await query(
    `INSERT INTO application_history (application_id, student_id, old_status, new_status, changed_by, comment)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [applicationId || null, studentId, oldStatus || null, newStatus, changedBy || null, comment || null]
  );
  return result.rows[0];
}

async function listHistoryForStudent(studentId) {
  const result = await query(
    `SELECT h.*, u.prenom AS changed_by_prenom, u.nom AS changed_by_nom
     FROM application_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.student_id = $1
     ORDER BY h.changed_at DESC`,
    [studentId]
  );
  return result.rows;
}

async function listArchived(auth, filters = {}) {
  const params = [];
  const conditions = [];

  // Role-based scoping
  if (auth.role === "SALES") {
    params.push(auth.sub);
    conditions.push(`ua.sales_id = $${params.length}`);
  } else if (auth.role === "RDV") {
    params.push(auth.sub);
    conditions.push(`ua.assigned_rdv_id = $${params.length}`);
  }

  // Archived = COMPLETED dossier, or CLOSED/REJECTED application
  conditions.push(`(sp.dossier_stage = 'COMPLETED' OR ua.status IN ('CLOSED', 'REJECTED'))`);

  // Optional filters for Admin
  if (filters.salesId) {
    params.push(filters.salesId);
    conditions.push(`ua.sales_id = $${params.length}`);
  }
  if (filters.countryId) {
    params.push(filters.countryId);
    conditions.push(`ua.country_id = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    conditions.push(`(LOWER(stu.prenom) LIKE $${params.length} OR LOWER(stu.nom) LIKE $${params.length} OR LOWER(stu.email) LIKE $${params.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await query(
    `SELECT
       ua.id,
       ua.student_id,
       ua.country_id,
       ua.university_id,
       ua.sales_id,
       ua.assigned_rdv_id,
       ua.status,
       ua.visa_status,
       ua.applied_at,
       ua.decision_at,
       ua.updated_at,
       sp.dossier_stage,
       sp.nationality,
       sp.residence_country,
       sp.phone AS student_phone,
       c.name AS country_name,
       cu.name AS university_name,
       stu.prenom AS student_prenom,
       stu.nom AS student_nom,
       stu.email AS student_email,
       stu.avatar_url AS student_avatar_url,
       sal.prenom AS sales_prenom,
       sal.nom AS sales_nom,
       rdv.prenom AS rdv_prenom,
       rdv.nom AS rdv_nom
     FROM university_applications ua
     JOIN users stu ON stu.id = ua.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = ua.student_id
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     LEFT JOIN users sal ON sal.id = ua.sales_id
     LEFT JOIN users rdv ON rdv.id = ua.assigned_rdv_id
     ${where}
     ORDER BY COALESCE(ua.decision_at, ua.updated_at) DESC`,
    params
  );
  return result.rows;
}

async function findRecentSuccesses(days = 7) {
  const result = await query(
    `SELECT ua.*, 
            c.name AS country_name, cu.name AS university_name, 
            stu.prenom AS student_prenom, stu.nom AS student_nom,
            sal.prenom AS sales_prenom, sal.nom AS sales_nom
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     JOIN users stu ON stu.id = ua.student_id
     LEFT JOIN users sal ON sal.id = ua.sales_id
     WHERE ua.updated_at >= NOW() - INTERVAL '${days} days'
       AND (ua.status = 'ACCEPTED' OR ua.visa_status = 'OBTAINED')
     ORDER BY ua.updated_at DESC
     LIMIT 50`
  );
  return result.rows;
}

// Toutes les candidatures actives (non clôturées), pour construire la vue
// pipeline admin — un étudiant peut en avoir plusieurs (une par pays visé).
async function listAllActive() {
  const result = await query(
    `SELECT ua.id, ua.student_id, ua.status, ua.visa_status, ua.updated_at, ua.decision_at, ua.assigned_rdv_id,
            c.name AS country_name, cu.name AS university_name
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     WHERE ua.status != 'CLOSED'
     ORDER BY ua.updated_at DESC`
  );
  return result.rows;
}

async function countVisaObtainedThisMonth() {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM university_applications
     WHERE visa_status = 'ACCEPTED'
       AND visa_decision_at >= date_trunc('month', NOW())`
  );
  return result.rows[0].count;
}

async function findAcceptedWithoutRdv() {
  const result = await query(
    `SELECT ua.*, c.name AS country_name, cu.name AS university_name,
            stu.prenom AS student_prenom, stu.nom AS student_nom
     FROM university_applications ua
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     JOIN users stu ON stu.id = ua.student_id
     WHERE ua.status = 'ACCEPTED' AND ua.assigned_rdv_id IS NULL
     ORDER BY COALESCE(ua.decision_at, ua.updated_at) ASC`
  );
  return result.rows;
}

module.exports = {
  findById,
  listForStudent,
  findActiveForStudent,
  create,
  update,
  listForRdv,
  countActiveForRdv,
  addHistory,
  listHistoryForStudent,
  listArchived,
  findRecentSuccesses,
  findAcceptedWithoutRdv,
  listAllActive,
  countVisaObtainedThisMonth
};
