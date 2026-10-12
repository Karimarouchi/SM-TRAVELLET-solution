const { query } = require("../../db");
const studentRepo = require("../repositories/studentRepository");
const { authRoles } = require("../security/rbac");
const { canViewStudent } = require("../security/studentView");

const MAX_LENGTH = 2000;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const ROLE_LABELS = { ADMIN: "Admin", SALES: "Conseiller", RDV: "Responsable Dossier" };

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
  return dto(result.rows[0], auth);
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
