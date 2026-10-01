const logger = require("../logger");
const repo = require("../repositories/notificationRepository");
const userRepo = require("../repositories/userRepository");
const studentRepo = require("../repositories/studentRepository");
const passport = require("./passport");

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
    await notifyPassportRisk(studentId, { admins: false, salesId });
  } catch (error) {
    logger.error("Échec de la notification d'attribution", { message: error.message });
  }
}

// Passeport expiré ou qui expire dans moins de 24 mois : prévient l'admin
// et/ou le conseiller. Ne fait rien si le passeport est valide ou inconnu.
async function notifyPassportRisk(studentId, { admins = true, salesId = null } = {}) {
  try {
    const [student, profile] = await Promise.all([userRepo.findById(studentId), studentRepo.findByUserId(studentId)]);
    if (!student || !profile) return;
    const expiresOn = passport.formatExpiry(profile.passport_expires_on);
    const status = passport.passportStatus({ hasPassport: profile.has_passport, expiresOn });
    if (!passport.isRisky(status)) return;

    const name = `${student.prenom} ${student.nom}`.trim();
    const expiry = passport.parseExpiry(expiresOn);
    const label = expiry.toLocaleDateString("fr-FR");
    const months = passport.monthsLeft(expiry);
    const payload = {
      type: "PASSPORT_EXPIRING",
      title: status === "EXPIRED" ? `Passeport expiré : ${name}` : `Passeport à renouveler : ${name}`,
      body:
        status === "EXPIRED"
          ? `Le passeport de ${name} a expiré le ${label}. Il doit être renouvelé avant toute démarche.`
          : `Le passeport de ${name} expire le ${label} (dans ${months < 1 ? "moins d'un mois" : `${months} mois`}), soit moins de ${passport.PASSPORT_MIN_VALIDITY_MONTHS} mois de validité.`,
      link: `/conseiller/etudiants/${studentId}`
    };
    if (admins) await notifyAdmins(payload);
    if (salesId) await notify(salesId, payload);
  } catch (error) {
    logger.error("Échec de la notification de passeport", { message: error.message });
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

module.exports = { notify, notifyAdmins, notifyStudentAssigned, notifyPassportRisk, list, unreadCount, markRead, markAllRead };
