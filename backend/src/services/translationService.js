const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const translationRepo = require("../repositories/translationRepository");
const studentRepo = require("../repositories/studentRepository");
const userRepo = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const studentDocumentService = require("./studentDocumentService");
const { canAccessStudent, authRoles } = require("../security/rbac");

const DOC_DIR = path.join(__dirname, "../../uploads/documents");
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertStaff(auth) {
  const roles = authRoles(auth);
  if (!roles.includes("SALES") && !roles.includes("ADMIN")) {
    throw fail("Seul le conseiller de l'étudiant ou un administrateur peut gérer les traductions.", 403);
  }
}

async function assertStudentAccess(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) throw fail("Vous n’avez pas accès à ce dossier.", 403);
  return profile;
}

async function studentLabel(studentId) {
  const student = await userRepo.findById(studentId);
  return student ? `${student.prenom} ${student.nom}`.trim() : "L'étudiant";
}

// Enregistre le fichier (image ou PDF, 5 Mo maximum) dans le dossier protégé des documents.
function storeFile(studentId, fileBase64, originalFilename) {
  if (!fileBase64 || typeof fileBase64 !== "string") throw fail("Aucun fichier fourni.", 400);
  const match = fileBase64.match(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/);
  if (!match) throw fail("Format de fichier non supporté (image ou PDF uniquement).", 400);
  const mimeType = match[1];
  const isPdf = mimeType === "application/pdf";
  const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw fail("Le fichier est invalide ou dépasse 5 Mo.", 400);
  const ext = isPdf ? "pdf" : mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  fs.mkdirSync(DOC_DIR, { recursive: true });
  const storedFilename = `trad_${String(studentId).slice(0, 8)}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(DOC_DIR, storedFilename), buffer);
  return {
    fileUrl: `/uploads/documents/${storedFilename}`,
    originalFilename: originalFilename ? String(originalFilename).slice(0, 255) : null,
    storedFilename,
    mimeType,
    fileSize: buffer.length
  };
}

const view = (row) => studentDocumentService.translationDto(row);

// Le conseiller (ou l'admin) demande la traduction d'un document déjà validé : un champ « traduction » s'ouvre.
async function request(auth, studentId, name, universityId) {
  assertStaff(auth);
  await assertStudentAccess(auth, studentId);
  const checklist = await studentDocumentService.getChecklist(studentId);
  const item = checklist.find((d) => d.name === String(name || "").trim() && (d.universityId || null) === (universityId || null));
  if (!item) throw fail("Document introuvable pour ce dossier.", 404);
  if (item.status !== "VALIDATED") throw fail("Le document doit d'abord être validé avant de demander sa traduction.", 409);
  const created = await translationRepo.create({ studentId, docName: item.name, universityId: item.universityId, requestedBy: auth.sub });
  if (!created) throw fail("Une traduction est déjà demandée pour ce document.", 409);
  await notificationService.notify(studentId, {
    type: "TRANSLATION_REQUESTED",
    title: `Traduction demandée : ${item.name}`,
    body: "Votre conseiller demande aussi la version traduite de ce document. Déposez-la dans votre espace Documents.",
    link: "/documents"
  });
  return view(created);
}

// Supprime la demande (seulement tant qu'aucun fichier n'a été déposé).
async function remove(auth, translationId) {
  assertStaff(auth);
  const row = await translationRepo.findById(translationId);
  if (!row) throw fail("Traduction introuvable.", 404);
  await assertStudentAccess(auth, row.student_id);
  if (row.file_url) throw fail("Un fichier a déjà été déposé : refusez-le ou remplacez-le plutôt que de supprimer la demande.", 409);
  await translationRepo.remove(translationId);
  return { id: translationId };
}

// L'étudiant dépose la version traduite : elle part en vérification chez son conseiller.
async function uploadByStudent(studentId, translationId, fileBase64, originalFilename) {
  const row = await translationRepo.findById(translationId);
  if (!row || row.student_id !== studentId) throw fail("Traduction introuvable.", 404);
  const stored = storeFile(studentId, fileBase64, originalFilename);
  const updated = await translationRepo.setFile(translationId, { ...stored, status: "SUBMITTED" });
  const profile = await studentRepo.ensureProfile(studentId);
  if (profile?.assigned_sales_id) {
    await notificationService.notify(profile.assigned_sales_id, {
      type: "TRANSLATION_UPLOADED",
      title: "Traduction déposée à vérifier",
      body: `${await studentLabel(studentId)} a déposé la traduction de « ${row.doc_name} ».`,
      link: `/conseiller/etudiants/${studentId}`
    });
  }
  return view(updated);
}

// Le conseiller (ou l'admin) dépose la traduction à la place de l'étudiant : validée automatiquement.
async function uploadByStaff(auth, translationId, fileBase64, originalFilename) {
  assertStaff(auth);
  const row = await translationRepo.findById(translationId);
  if (!row) throw fail("Traduction introuvable.", 404);
  await assertStudentAccess(auth, row.student_id);
  const stored = storeFile(row.student_id, fileBase64, originalFilename);
  const updated = await translationRepo.setFile(translationId, { ...stored, status: "VALIDATED", reviewedBy: auth.sub });
  await notificationService.notify(row.student_id, {
    type: "TRANSLATION_VALIDATED",
    title: `Traduction ajoutée et validée : ${row.doc_name}`,
    body: "Votre conseiller a ajouté la traduction de ce document à votre dossier.",
    link: "/documents"
  });
  return view(updated);
}

// Validation ou refus (avec motif) d'une traduction déposée par l'étudiant.
async function review(auth, translationId, status, reason) {
  assertStaff(auth);
  if (!["VALIDATED", "REJECTED"].includes(status)) throw fail("Statut invalide.", 400);
  const trimmed = String(reason || "").trim().slice(0, 500);
  if (status === "REJECTED" && !trimmed) throw fail("Un motif est obligatoire pour refuser une traduction.", 400);
  const row = await translationRepo.findById(translationId);
  if (!row) throw fail("Traduction introuvable.", 404);
  await assertStudentAccess(auth, row.student_id);
  if (!row.file_url) throw fail("Aucun fichier n'a encore été déposé pour cette traduction.", 400);
  const updated = await translationRepo.review(translationId, { status, reviewedBy: auth.sub, reason: status === "REJECTED" ? trimmed : null });
  await notificationService.notify(row.student_id, status === "REJECTED"
    ? { type: "TRANSLATION_REJECTED", title: `Traduction refusée : ${row.doc_name}`, body: `${trimmed}. Merci de la redéposer dans votre espace Documents.`, link: "/documents" }
    : { type: "TRANSLATION_VALIDATED", title: `Traduction validée : ${row.doc_name}`, body: "Votre traduction a été vérifiée et acceptée.", link: "/documents" });
  return view(updated);
}

module.exports = { request, remove, uploadByStudent, uploadByStaff, review };
