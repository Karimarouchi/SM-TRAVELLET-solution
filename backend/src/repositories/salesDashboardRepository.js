const { query } = require("../../db");

// Données brutes de l'espace conseiller : tout ce qui concerne les étudiants
// affectés à un conseiller, en peu de requêtes (jamais une par étudiant).

async function listStudents(salesId) {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, u.created_at, u.avatar_url, u.is_active,
            sp.onboarding_completed, sp.onboarding_completed_at, sp.dossier_stage, sp.phone, sp.city,
            sp.preferred_countries, sp.target_field, sp.has_passport, sp.passport_expires_on
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.assigned_sales_id = $1 AND u.role = 'STUDENT'
     ORDER BY u.created_at DESC`,
    [salesId]
  );
  return result.rows;
}

// Documents déposés : à valider, refusés, validés (un fichier compte une fois,
// même s'il couvre plusieurs pays).
async function documentCounts(salesId) {
  const result = await query(
    `SELECT sd.student_id,
            COUNT(DISTINCT sd.stored_filename) FILTER (WHERE sd.status = 'SUBMITTED') AS to_review,
            COUNT(DISTINCT sd.stored_filename) FILTER (WHERE sd.status = 'REJECTED') AS rejected,
            COUNT(DISTINCT sd.stored_filename) FILTER (WHERE sd.status = 'VALIDATED') AS validated
     FROM student_documents sd
     JOIN student_profiles sp ON sp.user_id = sd.student_id
     WHERE sp.assigned_sales_id = $1
     GROUP BY sd.student_id`,
    [salesId]
  );
  return result.rows;
}

// Candidatures non clôturées, la plus récente d'abord.
async function activeApplications(salesId) {
  const result = await query(
    `SELECT ua.id, ua.student_id, ua.status, ua.visa_status, ua.updated_at, ua.interview_date,
            ua.field_of_study, c.name AS country_name, cu.name AS university_name
     FROM university_applications ua
     JOIN student_profiles sp ON sp.user_id = ua.student_id
     JOIN countries c ON c.id = ua.country_id
     JOIN country_universities cu ON cu.id = ua.university_id
     WHERE sp.assigned_sales_id = $1 AND ua.status <> 'CLOSED'
     ORDER BY ua.updated_at DESC`,
    [salesId]
  );
  return result.rows;
}

// Vœux en cours (hors retirés).
async function choiceCounts(salesId) {
  const result = await query(
    `SELECT ch.student_id, COUNT(*)::int AS n
     FROM student_university_choices ch
     JOIN student_profiles sp ON sp.user_id = ch.student_id
     WHERE sp.assigned_sales_id = $1 AND ch.withdrawn_at IS NULL
     GROUP BY ch.student_id`,
    [salesId]
  );
  return result.rows;
}

module.exports = { listStudents, documentCounts, activeApplications, choiceCounts };
