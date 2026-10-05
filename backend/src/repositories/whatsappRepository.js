const { query } = require("../../db");

// Responsable effectif d'une conversation : le conseiller de l'étudiant lié
// (s'il est actif), sinon le sales attribué directement au contact. Calculé
// à la volée pour que la conversation suive automatiquement toute
// réaffectation de l'étudiant, quel que soit le chemin (glisser-déposer,
// transfert, code d'activation...).
const CONVERSATIONS_CTE = `
  WITH conv AS (
    SELECT wc.*,
      COALESCE(CASE WHEN ss.is_active THEN sp.assigned_sales_id END, wc.assigned_sales_id) AS owner_id,
      su.prenom AS student_prenom,
      su.nom AS student_nom
    FROM whatsapp_contacts wc
    LEFT JOIN users su ON su.id = wc.student_id
    LEFT JOIN student_profiles sp ON sp.user_id = wc.student_id
    LEFT JOIN users ss ON ss.id = sp.assigned_sales_id
  )`;

async function upsertContact(phone, profileName) {
  const result = await query(
    `INSERT INTO whatsapp_contacts (phone, profile_name)
     VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE
       SET profile_name = COALESCE(EXCLUDED.profile_name, whatsapp_contacts.profile_name),
           updated_at = NOW()
     RETURNING *`,
    [phone, profileName || null]
  );
  return result.rows[0];
}

async function findContactByPhone(phone) {
  const result = await query("SELECT * FROM whatsapp_contacts WHERE phone = $1", [phone]);
  return result.rows[0] || null;
}

async function findConversation(contactId) {
  const result = await query(`${CONVERSATIONS_CTE} SELECT * FROM conv WHERE id = $1`, [contactId]);
  return result.rows[0] || null;
}

// Numéros enregistrés sur les profils étudiants, normalisés comme ceux de
// Meta (chiffres seuls, sans "00" initial, indicatif 216 ajouté aux numéros
// tunisiens locaux à 8 chiffres).
async function findStudentByPhone(phone) {
  const result = await query(
    `SELECT u.id, sp.assigned_sales_id
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE u.role = 'STUDENT'
       AND sp.phone IS NOT NULL
       AND (
         CASE
           WHEN length(regexp_replace(regexp_replace(sp.phone, '[^0-9]', '', 'g'), '^00', '')) = 8
             THEN '216' || regexp_replace(regexp_replace(sp.phone, '[^0-9]', '', 'g'), '^00', '')
           ELSE regexp_replace(regexp_replace(sp.phone, '[^0-9]', '', 'g'), '^00', '')
         END
       ) = $1
     ORDER BY u.created_at DESC
     LIMIT 1`,
    [phone]
  );
  return result.rows[0] || null;
}

async function findStudentForLink(studentId) {
  const result = await query(
    `SELECT u.id, sp.assigned_sales_id
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'STUDENT'`,
    [studentId]
  );
  return result.rows[0] || null;
}

async function setStudent(contactId, studentId) {
  await query(
    "UPDATE whatsapp_contacts SET student_id = $2, updated_at = NOW() WHERE id = $1",
    [contactId, studentId]
  );
}

async function setAssignedSales(contactId, salesId) {
  await query(
    "UPDATE whatsapp_contacts SET assigned_sales_id = $2, updated_at = NOW() WHERE id = $1",
    [contactId, salesId]
  );
}

async function isActiveSales(userId) {
  const result = await query(
    "SELECT 1 FROM users WHERE id = $1 AND role = 'SALES' AND is_active = TRUE",
    [userId]
  );
  return result.rowCount > 0;
}

async function findLeastLoadedActiveSales() {
  const result = await query(
    `${CONVERSATIONS_CTE}
     SELECT u.id, COUNT(c.id)::int AS load
     FROM users u
     LEFT JOIN conv c ON c.owner_id = u.id
     WHERE u.role = 'SALES' AND u.is_active = TRUE
     GROUP BY u.id, u.created_at
     ORDER BY load ASC, u.created_at ASC
     LIMIT 1`
  );
  return result.rows[0] || null;
}

async function insertMessage({ contactId, waMessageId, direction, type, body, status, sentBy, sentAs, createdAt }) {
  const result = await query(
    `INSERT INTO whatsapp_messages (contact_id, wa_message_id, direction, type, body, status, sent_by, sent_as_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()))
     ON CONFLICT (wa_message_id) DO NOTHING
     RETURNING *`,
    [contactId, waMessageId || null, direction, type, body, status, sentBy || null, sentAs || null, createdAt || null]
  );
  return result.rows[0] || null;
}

async function touchInbound(contactId, at) {
  await query(
    `UPDATE whatsapp_contacts
     SET last_inbound_at = GREATEST(COALESCE(last_inbound_at, $2), $2),
         last_message_at = GREATEST(COALESCE(last_message_at, $2), $2),
         updated_at = NOW()
     WHERE id = $1`,
    [contactId, at]
  );
}

async function touchOutbound(contactId) {
  await query(
    "UPDATE whatsapp_contacts SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1",
    [contactId]
  );
}

// Meta peut livrer les statuts dans le désordre : un statut ne fait jamais
// reculer un message (read ne redevient pas delivered), sauf "failed".
async function updateStatus(waMessageId, status, error) {
  await query(
    `UPDATE whatsapp_messages
     SET status = $2, error = $3
     WHERE wa_message_id = $1
       AND direction = 'out'
       AND (
         $2 = 'failed'
         OR (CASE $2 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END)
          > (CASE status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END)
       )`,
    [waMessageId, status, error || null]
  );
}

async function listConversations({ userId, ownerId, search, contactId = null }) {
  const result = await query(
    `${CONVERSATIONS_CTE}
     SELECT c.id, c.phone, c.profile_name, c.student_id, c.student_prenom, c.student_nom,
            c.owner_id, ou.prenom AS owner_prenom, ou.nom AS owner_nom,
            c.last_inbound_at, c.last_message_at,
            lm.body AS last_body, lm.direction AS last_direction, lm.status AS last_status,
            lm.hidden_at IS NOT NULL AS last_hidden,
            (SELECT COUNT(*)::int FROM whatsapp_messages m
             WHERE m.contact_id = c.id AND m.direction = 'in'
               AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)) AS unread
     FROM conv c
     LEFT JOIN users ou ON ou.id = c.owner_id
     LEFT JOIN whatsapp_reads r ON r.contact_id = c.id AND r.user_id = $1
     LEFT JOIN LATERAL (
       SELECT body, direction, status, hidden_at FROM whatsapp_messages
       WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1
     ) lm ON TRUE
     WHERE ($2::uuid IS NULL OR c.owner_id = $2)
       AND ($4::uuid IS NULL OR c.id = $4)
       AND (
         $3 = ''
         OR c.phone ILIKE '%' || $3 || '%'
         OR c.profile_name ILIKE '%' || $3 || '%'
         OR (c.student_prenom || ' ' || c.student_nom) ILIKE '%' || $3 || '%'
       )
     ORDER BY c.last_message_at DESC NULLS LAST
     LIMIT 300`,
    [userId, ownerId, search, contactId]
  );
  return result.rows;
}

async function listMessages(contactId, { before, limit }) {
  const result = await query(
    `SELECT m.id, m.direction, m.type, m.body, m.status, m.error, m.created_at,
            -- Auteur AFFICHÉ : le conseiller au nom de qui l'admin a répondu, sinon l'expéditeur réel.
            COALESCE(sa.prenom, u.prenom) AS sender_prenom, COALESCE(sa.nom, u.nom) AS sender_nom,
            (m.sent_as_id IS NOT NULL AND m.sent_as_id IS DISTINCT FROM m.sent_by) AS sent_by_admin,
            m.hidden_at, h.prenom AS hidden_prenom, h.nom AS hidden_nom
     FROM whatsapp_messages m
     LEFT JOIN users u ON u.id = m.sent_by
     LEFT JOIN users sa ON sa.id = m.sent_as_id
     LEFT JOIN users h ON h.id = m.hidden_by
     WHERE m.contact_id = $1 AND ($2::timestamptz IS NULL OR m.created_at < $2)
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [contactId, before, limit]
  );
  return result.rows.reverse();
}

async function findMessage(contactId, messageId) {
  const result = await query(
    "SELECT id, direction, hidden_at FROM whatsapp_messages WHERE id = $1 AND contact_id = $2",
    [messageId, contactId]
  );
  return result.rows[0] || null;
}

async function hideMessage(messageId, userId) {
  await query(
    "UPDATE whatsapp_messages SET hidden_at = NOW(), hidden_by = $2 WHERE id = $1 AND hidden_at IS NULL",
    [messageId, userId]
  );
}

async function markRead(contactId, userId) {
  await query(
    `INSERT INTO whatsapp_reads (contact_id, user_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (contact_id, user_id) DO UPDATE SET last_read_at = NOW()`,
    [contactId, userId]
  );
}

async function unreadCount({ userId, ownerId }) {
  const result = await query(
    `${CONVERSATIONS_CTE}
     SELECT
       COALESCE(SUM(u.n) FILTER (WHERE c.student_id IS NOT NULL), 0)::int AS registered,
       COALESCE(SUM(u.n) FILTER (WHERE c.student_id IS NULL), 0)::int AS prospects
     FROM conv c
     LEFT JOIN whatsapp_reads r ON r.contact_id = c.id AND r.user_id = $1
     CROSS JOIN LATERAL (
       SELECT COUNT(*) AS n FROM whatsapp_messages m
       WHERE m.contact_id = c.id AND m.direction = 'in'
         AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
     ) u
     WHERE ($2::uuid IS NULL OR c.owner_id = $2)`,
    [userId, ownerId]
  );
  const { registered, prospects } = result.rows[0];
  // « Inscrits » = conversation liée à un compte étudiant ; « prospects » = les autres.
  return { unread: registered + prospects, registered, prospects };
}

async function reassignAllFromSales(fromSalesId, toSalesId) {
  const result = await query(
    "UPDATE whatsapp_contacts SET assigned_sales_id = $2, updated_at = NOW() WHERE assigned_sales_id = $1",
    [fromSalesId, toSalesId]
  );
  return result.rowCount;
}

async function listContactIdsAssignedTo(salesId) {
  const result = await query(
    "SELECT id FROM whatsapp_contacts WHERE assigned_sales_id = $1 ORDER BY last_message_at DESC NULLS LAST",
    [salesId]
  );
  return result.rows.map((row) => row.id);
}

// Contacts sans responsable effectif actif : jamais attribués, ou attribués
// à un sales désormais inactif sans étudiant lié actif.
async function listOrphanContactIds() {
  const result = await query(
    `${CONVERSATIONS_CTE}
     SELECT c.id FROM conv c
     LEFT JOIN users ou ON ou.id = c.owner_id
     WHERE c.owner_id IS NULL OR ou.is_active IS NOT TRUE
     ORDER BY c.last_message_at DESC NULLS LAST`
  );
  return result.rows.map((row) => row.id);
}

module.exports = {
  upsertContact,
  findContactByPhone,
  findConversation,
  findStudentByPhone,
  findStudentForLink,
  setStudent,
  setAssignedSales,
  isActiveSales,
  findLeastLoadedActiveSales,
  insertMessage,
  touchInbound,
  touchOutbound,
  updateStatus,
  listConversations,
  listMessages,
  findMessage,
  hideMessage,
  markRead,
  unreadCount,
  reassignAllFromSales,
  listContactIdsAssignedTo,
  listOrphanContactIds,
  CONVERSATIONS_CTE
};
