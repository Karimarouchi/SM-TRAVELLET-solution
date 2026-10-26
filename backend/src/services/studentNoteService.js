const { query } = require("../../db");
const studentRepo = require("../repositories/studentRepository");
const { authRoles } = require("../security/rbac");
const { canViewStudent } = require("../security/studentView");
const notificationService = require("./notificationService");
const logger = require("../logger");

const MAX_LENGTH = 2000;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const ROLE_LABELS = { ADMIN: "Admin", SALES: "Conseiller(ère) commercial(e)", RDV: "Gestionnaire de dossiers" };

function dto(row, auth) {
  const isAdmin = authRoles(auth).includes("ADMIN");
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorId: row.author_id,
    authorName: row.prenom ? `${row.prenom} ${row.nom || ""}`.trim() : "Ancien collaborateur",
    authorRole: ROLE_LABELS[row.role] || "",
    // L'auteur supprime ses remarques ; l'admin supprime toutes les remarques.
    canDelete: isAdmin || row.author_id === auth.sub
  };
}

// Réservé à l'équipe SM : jamais renvoyé à un étudiant (les routes exigent un rôle du personnel).
async function assertAccess(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!(await canViewStudent(auth, studentId, profile.assigned_sales_id))) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
}

async function list(auth, studentId) {
  await assertAccess(auth, studentId);
  const result = await query(
    `SELECT n.*, u.prenom, u.nom, u.role
     FROM student_notes n LEFT JOIN users u ON u.id = n.author_id
     WHERE n.student_id = $1 ORDER BY n.created_at DESC`,
    [studentId]
  );
  return result.rows.map((row) => dto(row, auth));
}

async function create(auth, studentId, rawBody) {
  await assertAccess(auth, studentId);
  const body = String(rawBody || "").trim();
  if (!body) throw fail("Écrivez votre remarque.", 400);
  if (body.length > MAX_LENGTH) throw fail(`La remarque est trop longue (${MAX_LENGTH} caractères maximum).`, 400);
  const inserted = await query("INSERT INTO student_notes (student_id, author_id, body) VALUES ($1, $2, $3) RETURNING id", [studentId, auth.sub, body]);
  const result = await query(
    `SELECT n.*, u.prenom, u.nom, u.role FROM student_notes n LEFT JOIN users u ON u.id = n.author_id WHERE n.id = $1`,
    [inserted.rows[0].id]
  );
  await notifyTeam(auth, studentId, result.rows[0]);
  return dto(result.rows[0], auth);
}

// Nouvelle remarque : toute l'équipe qui suit l'étudiant est prévenue (son conseiller, ses Responsables
// Dossier, et leurs remplaçants pendant un congé) ainsi que les admins. L'auteur n'est jamais notifié.
async function notifyTeam(auth, studentId, note) {
  try {
    const [team, admins] = await Promise.all([
      query(
        `SELECT u.prenom AS student_prenom, u.nom AS student_nom, sp.assigned_sales_id,
                COALESCE((SELECT array_agg(DISTINCT ua.assigned_rdv_id) FROM university_applications ua
                          WHERE ua.student_id = u.id AND ua.assigned_rdv_id IS NOT NULL AND ua.status <> 'CLOSED'), '{}') AS rdv_ids
         FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id WHERE u.id = $1`,
        [studentId]
      ),
      query(
        `SELECT DISTINCT u.id FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE u.is_active = TRUE AND (u.role = 'ADMIN' OR ur.role = 'ADMIN')`
      )
    ]);
    const row = team.rows[0];
    if (!row) return;
    const student = `${row.student_prenom || ""} ${row.student_nom || ""}`.trim() || "un étudiant";
    const author = note.prenom ? `${note.prenom} ${note.nom || ""}`.trim() : "Un collaborateur";
    const preview = note.body.length > 160 ? `${note.body.slice(0, 157)}…` : note.body;
    const payload = { type: "STUDENT_NOTE", title: `Nouvelle remarque sur ${student}`, body: `${author} : ${preview}` };
    const notified = new Set([auth.sub]);
    const send = async (ids, extra) => {
      const targets = [...new Set(ids)].filter((id) => id && !notified.has(id));
      targets.forEach((id) => notified.add(id));
      if (targets.length) await notificationService.notify(targets, { ...payload, ...extra });
    };
    await send(admins.rows.map((r) => r.id), { link: `/conseiller/etudiants/${studentId}` });
    await send([row.assigned_sales_id], { link: `/conseiller/etudiants/${studentId}`, coverItem: studentId, coverScope: "SALES" });
    await send(row.rdv_ids || [], { link: `/rdv/etudiants/${studentId}`, coverItem: studentId, coverScope: "RDV" });
  } catch (error) {
    logger.error("Remarque : notification de l'équipe impossible", { studentId, message: error.message });
  }
}

async function remove(auth, noteId) {
  const found = await query("SELECT * FROM student_notes WHERE id = $1", [noteId]);
  const note = found.rows[0];
  if (!note) throw fail("Remarque introuvable.", 404);
  const isAdmin = authRoles(auth).includes("ADMIN");
  if (!isAdmin && note.author_id !== auth.sub) throw fail("Vous ne pouvez supprimer que vos propres remarques.", 403);
  await query("DELETE FROM student_notes WHERE id = $1", [noteId]);
  return { id: noteId };
}

module.exports = { list, create, remove };
