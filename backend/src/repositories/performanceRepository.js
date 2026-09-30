const { query } = require("../../db");

async function listSalesStudents() {
  const result = await query(
    `SELECT u.id AS sales_id, u.prenom, u.nom, u.email, u.is_active,
            sp.user_id AS student_id,
            sp.created_at AS assigned_at,
            sp.onboarding_completed_at,
            sp.dossier_stage
     FROM users u
     LEFT JOIN student_profiles sp ON sp.assigned_sales_id = u.id
     WHERE u.role = 'SALES' OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'SALES')
     ORDER BY u.prenom, u.nom`
  );
  return result.rows;
}

async function listApplicationsForTiming() {
  const result = await query(
    `SELECT ua.id, ua.student_id, ua.sales_id, ua.assigned_rdv_id, ua.country_id,
            ua.status, ua.created_at, ua.applied_at, ua.decision_at,
            ua.visa_status, ua.visa_submitted_at, ua.visa_decision_at, ua.visa_docs_validated_at,
            rdv.prenom AS rdv_prenom, rdv.nom AS rdv_nom, rdv.email AS rdv_email, rdv.is_active AS rdv_active,
            sales.prenom AS sales_prenom, sales.nom AS sales_nom, sales.email AS sales_email
     FROM university_applications ua
     LEFT JOIN users rdv ON rdv.id = ua.assigned_rdv_id
     LEFT JOIN users sales ON sales.id = ua.sales_id
     WHERE ua.status <> 'CLOSED'
     ORDER BY ua.created_at DESC`
  );
  return result.rows;
}

async function listWhatsAppReplyPairs() {
  const result = await query(
    `SELECT c.assigned_sales_id,
            inbound.created_at AS inbound_at,
            (
              SELECT MIN(outbound.created_at)
              FROM whatsapp_messages outbound
              WHERE outbound.contact_id = inbound.contact_id
                AND outbound.direction = 'out'
                AND outbound.created_at > inbound.created_at
            ) AS reply_at
     FROM whatsapp_messages inbound
     JOIN whatsapp_contacts c ON c.id = inbound.contact_id
     WHERE inbound.direction = 'in' AND c.assigned_sales_id IS NOT NULL`
  );
  return result.rows;
}

async function listWhatsAppConversationCounts(since) {
  const result = await query(
    `SELECT assigned_sales_id AS sales_id, COUNT(*)::int AS count
     FROM whatsapp_contacts
     WHERE assigned_sales_id IS NOT NULL
       AND last_message_at IS NOT NULL
       AND last_message_at >= $1
     GROUP BY assigned_sales_id`,
    [since]
  );
  return result.rows;
}

module.exports = {
  listSalesStudents,
  listApplicationsForTiming,
  listWhatsAppReplyPairs,
  listWhatsAppConversationCounts
};
