const { query } = require("../../db");
const { CONVERSATIONS_CTE } = require("./whatsappRepository");

// Conseillers et Responsables Visa (rôle de base ou rôle additionnel).
async function listStaff() {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, COALESCE(sp.phone, '') AS phone, u.is_active, u.role,
            ARRAY(SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id) AS extra_roles
     FROM users u
     LEFT JOIN sales_profiles sp ON sp.user_id = u.id
     WHERE u.role IN ('SALES', 'RDV')
        OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role IN ('SALES', 'RDV'))
     ORDER BY u.prenom, u.nom`
  );
  return result.rows;
}

// Une ligne par conversation WhatsApp, avec son responsable effectif (même
// règle que la messagerie) et ce qu'il en est advenu.
async function listConversations() {
  const result = await query(
    `${CONVERSATIONS_CTE}
     SELECT c.id, c.phone, c.profile_name, c.student_id, c.student_prenom, c.student_nom,
            c.owner_id, c.created_at, c.last_message_at,
            (SELECT MIN(m.created_at) FROM whatsapp_messages m WHERE m.contact_id = c.id AND m.direction = 'in') AS first_inbound_at,
            (SELECT MAX(m.created_at) FROM whatsapp_messages m WHERE m.contact_id = c.id AND m.direction = 'in') AS last_inbound_at,
            EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.contact_id = c.id AND m.direction = 'out') AS answered,
            EXISTS (SELECT 1 FROM sales_codes sc WHERE sc.whatsapp_contact_id = c.id) AS code_sent
     FROM conv c`
  );
  return result.rows;
}

// Messages dans l'ordre, pour découper les « tours » : premier message
// entrant sans réponse → première réponse.
async function listMessagesForTurns(since) {
  const result = await query(
    `SELECT contact_id, direction, sent_by, created_at
     FROM whatsapp_messages
     WHERE ($1::timestamptz IS NULL OR created_at >= $1::timestamptz - INTERVAL '30 days')
     ORDER BY contact_id, created_at`,
    [since]
  );
  return result.rows;
}

async function listSalesStudents() {
  const result = await query(
    `SELECT sp.user_id AS student_id, sp.assigned_sales_id AS sales_id,
            su.prenom, su.nom,
            COALESCE(sp.onboarding_completed_at, sp.created_at) AS started_at,
            sp.dossier_stage,
            (SELECT MIN(ua.created_at) FROM university_applications ua WHERE ua.student_id = sp.user_id) AS handed_off_at
     FROM student_profiles sp
     JOIN users su ON su.id = sp.user_id
     WHERE sp.assigned_sales_id IS NOT NULL`
  );
  return result.rows;
}

async function listDocumentReviews(since) {
  const result = await query(
    `SELECT reviewed_by, status, submitted_at, reviewed_at
     FROM student_documents
     WHERE reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND submitted_at IS NOT NULL
       AND ($1::timestamptz IS NULL OR reviewed_at >= $1::timestamptz)`,
    [since]
  );
  return result.rows;
}

async function listApplications() {
  const result = await query(
    `SELECT ua.id, ua.student_id, ua.sales_id, ua.assigned_rdv_id, ua.status,
            ua.created_at, ua.applied_at, ua.decision_at,
            ua.visa_status, ua.visa_docs_validated_at, ua.visa_submitted_at, ua.visa_decision_at,
            su.prenom AS student_prenom, su.nom AS student_nom, c.name AS country_name, cu.name AS university_name
     FROM university_applications ua
     JOIN users su ON su.id = ua.student_id
     LEFT JOIN countries c ON c.id = ua.country_id
     LEFT JOIN country_universities cu ON cu.id = ua.university_id`
  );
  return result.rows;
}

// Chaque document vérifié par un employé (détail de la page employé).
async function listReviewEvents(userId) {
  const result = await query(
    `SELECT sd.id, sd.status, sd.submitted_at, sd.reviewed_at, dr.name AS doc_name, dr.category,
            su.prenom AS student_prenom, su.nom AS student_nom
     FROM student_documents sd
     JOIN document_requirements dr ON dr.id = sd.document_requirement_id
     JOIN users su ON su.id = sd.student_id
     WHERE sd.reviewed_by = $1 AND sd.reviewed_at IS NOT NULL AND sd.submitted_at IS NOT NULL
     ORDER BY sd.reviewed_at DESC
     LIMIT 3000`,
    [userId]
  );
  return result.rows;
}

async function listCodes() {
  const result = await query(
    "SELECT sales_id, used, used_at, created_at, whatsapp_contact_id FROM sales_codes"
  );
  return result.rows;
}

module.exports = {
  listStaff,
  listConversations,
  listMessagesForTurns,
  listSalesStudents,
  listDocumentReviews,
  listReviewEvents,
  listApplications,
  listCodes
};
