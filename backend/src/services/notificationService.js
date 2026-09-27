const logger = require("../logger");
const repo = require("../repositories/notificationRepository");
const userRepo = require("../repositories/userRepository");

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Une notification ne doit jamais faire échouer l'action qui la déclenche
// (valider un document, attribuer un étudiant...) : les erreurs sont
// seulement journalisées.
async function notify(userIds, payload) {
  const ids = [].concat(userIds).filter(Boolean);
  try {
    await repo.createForUsers([...new Set(ids)], payload);
  } catch (error) {
    logger.error("Échec de la création d'une notification", { message: error.message, type: payload.type });
  }
}

async function notifyAdmins(payload) {
  try {
    await notify(await repo.listActiveAdminIds(), payload);
  } catch (error) {
    logger.error("Échec de la notification des admins", { message: error.message, type: payload.type });
  }
}

async function notifyStudentAssigned(salesId, studentId) {
  if (!salesId) return;
  try {
    const student = await userRepo.findById(studentId);
    await notify(salesId, {
      type: "STUDENT_ASSIGNED",
      title: "Nouvel étudiant attribué",
      body: `${student ? `${student.prenom} ${student.nom}` : "Un étudiant"} vous a été attribué.`,
      link: `/conseiller/etudiants/${studentId}`
    });
  } catch (error) {
    logger.error("Échec de la notification d'attribution", { message: error.message });
  }
}

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || "",
    link: row.link || null,
    read: Boolean(row.read_at),
    createdAt: new Date(row.created_at).toISOString()
  };
}

async function list(auth, { before, limit, unread }) {
  const pageSize = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;
  const rows = await repo.listForUser(auth.sub, { before: beforeDate, limit: pageSize, unreadOnly: unread === "true" });
  return { notifications: rows.map(mapNotification), hasMore: rows.length === pageSize };
}

async function unreadCount(auth) {
  return repo.unreadCount(auth.sub);
}

async function markRead(auth, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw fail("Notification introuvable.", 404);
  await repo.markRead(auth.sub, id);
}

async function markAllRead(auth) {
  await repo.markAllRead(auth.sub);
}

module.exports = { notify, notifyAdmins, notifyStudentAssigned, list, unreadCount, markRead, markAllRead };
