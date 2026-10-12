const { query } = require("../../db");
const studentRepo = require("../repositories/studentRepository");
const { canViewStudent } = require("../security/studentView");

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dto(row, { forStaff = false } = {}) {
  const sender = row.prenom ? `${row.prenom} ${row.nom || ""}`.trim() : "";
  return {
    id: row.id,
    subject: row.subject,
    body: row.body,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    sentAt: row.sent_at,
    senderName: sender,
    read: Boolean(row.read_at),
    // Preuve de lecture : visible par l'équipe seulement.
    readAt: forStaff ? row.read_at : undefined
  };
}

// Mail envoyé depuis l'application à un étudiant inscrit : une copie est gardée dans son espace.
async function record({ studentId, sentBy, subject, body, attachments, messageId }) {
  await query(
    `INSERT INTO student_mails (student_id, sent_by, subject, body, attachments, message_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [studentId, sentBy, subject.slice(0, 300), body.slice(0, 100000), JSON.stringify(attachments || []), messageId || null]
  );
}

const SELECT = `SELECT m.*, u.prenom, u.nom FROM student_mails m LEFT JOIN users u ON u.id = m.sent_by`;

async function listMine(studentId) {
  const result = await query(`${SELECT} WHERE m.student_id = $1 ORDER BY m.sent_at DESC LIMIT 200`, [studentId]);
  return result.rows.map((row) => dto(row));
}

async function unreadMine(studentId) {
  const result = await query("SELECT COUNT(*)::int AS n FROM student_mails WHERE student_id = $1 AND read_at IS NULL", [studentId]);
  return { unread: result.rows[0].n };
}

async function markRead(studentId, mailId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(mailId))) throw fail("Mail introuvable.", 404);
  const result = await query(
    "UPDATE student_mails SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND student_id = $2 RETURNING id",
    [mailId, studentId]
  );
  if (!result.rows[0]) throw fail("Mail introuvable.", 404);
  return { id: mailId };
}

// Pour l'équipe : mails envoyés à un étudiant (conseiller assigné, Responsable Dossier concerné, admin).
async function listForStaff(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!(await canViewStudent(auth, studentId, profile.assigned_sales_id))) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  const result = await query(`${SELECT} WHERE m.student_id = $1 ORDER BY m.sent_at DESC LIMIT 200`, [studentId]);
  return result.rows.map((row) => dto(row, { forStaff: true }));
}

module.exports = { record, listMine, unreadMine, markRead, listForStaff };
