const fs = require("fs");
const path = require("path");
const studentDocRepo = require("../repositories/studentDocumentRepository");
const studentRepo = require("../repositories/studentRepository");
const appRepo = require("../repositories/universityApplicationRepository");
const messageRepo = require("../repositories/messageRepository");
const { canAccessStudent, authRoles } = require("../security/rbac");
const universityApplicationService = require("./universityApplicationService");
const logger = require("../logger");

const DOC_DIR = path.join(__dirname, "../../uploads/documents");
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB, cohérent avec les autres uploads du projet

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Un même nom de document peut correspondre à plusieurs document_requirements
// (un par pays préféré de l'étudiant) : côté étudiant, ils sont fusionnés en
// un seul élément de checklist — un seul upload satisfait toutes les lignes.
function groupByName(requirements) {
  const map = new Map();
  for (const r of requirements) {
    if (!map.has(r.name)) map.set(r.name, []);
    map.get(r.name).push(r);
  }
  return map;
}

function intersectAcceptedFileTypes(group) {
  const toSet = (t) => (t === "IMAGE_PDF" ? new Set(["IMAGE", "PDF"]) : new Set([t]));
  const inter = group.map((g) => toSet(g.accepted_file_types)).reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
  if (inter.size === 2) return "IMAGE_PDF";
  if (inter.has("IMAGE")) return "IMAGE";
  if (inter.has("PDF")) return "PDF";
  return "IMAGE_PDF";
}

function mergedDto(name, group, studentDocsByReqId) {
  const representative = group.map((g) => studentDocsByReqId.get(g.id)).find(Boolean) || null;
  return {
    name,
    description: group[0].description,
    required: group.some((g) => g.required),
    acceptedFileTypes: intersectAcceptedFileTypes(group),
    countries: group.map((g) => g.country_name),
    status: representative ? representative.status : "PENDING",
    fileUrl: representative ? representative.file_url : null,
    originalFilename: representative ? representative.original_filename : null,
    rejectionReason: representative ? representative.rejection_reason : null,
    submittedAt: representative ? representative.submitted_at : null,
    reviewedAt: representative ? representative.reviewed_at : null
  };
}

async function getChecklist(studentUserId) {
  const profile = await studentRepo.findByUserId(studentUserId);
  const preferredCountries = profile?.preferred_countries || [];
  if (!preferredCountries.length) return [];

  const requirements = await studentDocRepo.findActiveRequirementsByCountryNames(preferredCountries);
  if (!requirements.length) return [];

  const reqIds = requirements.map((r) => r.id);
  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(studentUserId, reqIds);
  const byReqId = new Map(existing.map((d) => [d.document_requirement_id, d]));

  const groups = groupByName(requirements);
  return Array.from(groups.entries()).map(([name, group]) => mergedDto(name, group, byReqId));
}

async function uploadDocument(studentUserId, name, fileBase64, originalFilename) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw fail("Nom de document manquant.", 400);
  if (!fileBase64 || typeof fileBase64 !== "string") throw fail("Aucun fichier fourni.", 400);

  const profile = await studentRepo.findByUserId(studentUserId);
  const preferredCountries = profile?.preferred_countries || [];
  if (!preferredCountries.length) throw fail("Aucun pays préféré sélectionné.", 400);

  const requirements = await studentDocRepo.findActiveRequirementsByCountryNames(preferredCountries);
  const group = requirements.filter((r) => r.name === trimmedName);
  if (!group.length) throw fail("Ce document ne fait pas partie de votre checklist actuelle.", 404);

  const match = fileBase64.match(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/);
  if (!match) throw fail("Format de fichier non supporté (image ou PDF uniquement).", 400);
  const mimeType = match[1];
  const isPdf = mimeType === "application/pdf";

  for (const req of group) {
    if (req.accepted_file_types === "IMAGE" && isPdf) {
      throw fail(`Ce document doit être une image pour ${req.country_name}.`, 400);
    }
    if (req.accepted_file_types === "PDF" && !isPdf) {
      throw fail(`Ce document doit être un PDF pour ${req.country_name}.`, 400);
    }
  }

  const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw fail("Le fichier est invalide ou dépasse 5 Mo.", 400);
  }

  const ext = isPdf ? "pdf" : (mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1]);
  fs.mkdirSync(DOC_DIR, { recursive: true });
  const storedFilename = `doc_${studentUserId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(DOC_DIR, path.basename(storedFilename)), buffer);
  const fileUrl = `/uploads/documents/${storedFilename}`;

  await studentDocRepo.upsertForRequirementIds(studentUserId, group.map((g) => g.id), {
    fileUrl,
    originalFilename: originalFilename ? String(originalFilename).slice(0, 255) : null,
    storedFilename,
    mimeType,
    fileSize: buffer.length
  });

  const checklist = await getChecklist(studentUserId);
  return checklist.find((d) => d.name === trimmedName);
}

async function getChecklistFor(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return getChecklist(studentId);
}

// Validation / rejet par Sales (assigné) ou Admin. S'applique à tous les
// document_requirements fusionnés sous ce nom (mêmes règles que l'upload).
async function reviewDocument(auth, studentId, name, status, reason) {
  if (auth.role !== "SALES" && auth.role !== "ADMIN") {
    throw fail("Seul un conseiller ou un administrateur peut valider un document.", 403);
  }
  if (!["VALIDATED", "REJECTED"].includes(status)) {
    throw fail("Statut invalide.", 400);
  }
  const trimmedReason = String(reason || "").trim();
  if (status === "REJECTED" && !trimmedReason) {
    throw fail("Un motif est obligatoire pour refuser un document.", 400);
  }

  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }

  const trimmedName = String(name || "").trim();
  const requirements = await studentDocRepo.findActiveRequirementsByCountryNames(profile.preferred_countries || []);
  const group = requirements.filter((r) => r.name === trimmedName);
  if (!group.length) throw fail("Document introuvable pour ce dossier.", 404);

  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(studentId, group.map((g) => g.id));
  if (!existing.some((d) => d.file_url)) {
    throw fail("Aucun fichier n’a encore été déposé pour ce document.", 400);
  }

  await studentDocRepo.updateStatusForRequirementIds(
    studentId,
    group.map((g) => g.id),
    status,
    auth.sub,
    status === "REJECTED" ? trimmedReason : null
  );

  if (profile.assigned_sales_id) {
    const body = status === "REJECTED"
      ? `Document « ${trimmedName} » refusé : ${trimmedReason}. Merci de le redéposer dans votre espace Documents.`
      : `Document « ${trimmedName} » validé ✓`;
    const conversation = await messageRepo.createPair(studentId, profile.assigned_sales_id);
    await messageRepo.insertMessage(conversation.id, null, body);
  }

  if (status === "VALIDATED") {
    // Ne bloque jamais la validation du document si le calcul READY_TO_APPLY
    // échoue pour une raison quelconque (ex: université non reconnue).
    await universityApplicationService.checkAndAdvanceReadyToApply(studentId).catch((err) => {
      logger.error("Échec du calcul READY_TO_APPLY", { message: err.message, stack: err.stack });
    });
  }

  const checklist = await getChecklist(studentId);
  return checklist.find((d) => d.name === trimmedName);
}

// -------------------------------------------------------------------------
// Documents VISA — même mécanique que les documents DOSSIER ci-dessus, mais
// scopée à une candidature précise (un seul pays) plutôt qu'à la liste des
// pays préférés de l'étudiant, et réservée au RDV assigné (ou Admin) côté
// review au lieu de Sales/Admin.
// -------------------------------------------------------------------------

function visaDto(requirement, studentDoc) {
  return {
    requirementId: requirement.id,
    name: requirement.name,
    description: requirement.description,
    required: requirement.required,
    acceptedFileTypes: requirement.accepted_file_types,
    status: studentDoc ? studentDoc.status : "PENDING",
    fileUrl: studentDoc ? studentDoc.file_url : null,
    originalFilename: studentDoc ? studentDoc.original_filename : null,
    rejectionReason: studentDoc ? studentDoc.rejection_reason : null,
    submittedAt: studentDoc ? studentDoc.submitted_at : null,
    reviewedAt: studentDoc ? studentDoc.reviewed_at : null
  };
}

async function getVisaChecklist(countryId, studentId) {
  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(countryId);
  if (!requirements.length) return [];
  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(studentId, requirements.map((r) => r.id));
  const byReqId = new Map(existing.map((d) => [d.document_requirement_id, d]));
  return requirements.map((r) => visaDto(r, byReqId.get(r.id)));
}

// La candidature "active" pour la partie visa : la plus récente ayant un
// visa_status renseigné (donc arrivée au moins à l'étape préparation visa)
// et non clôturée.
async function findActiveVisaApplicationForStudent(studentId) {
  const rows = await appRepo.findActiveForStudent(studentId);
  return rows.find((r) => r.visa_status) || null;
}

function assertVisaDocAccess(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  if (roles.includes("RDV") && application.assigned_rdv_id === auth.sub) return;
  throw fail("Vous n’avez pas accès à ce dossier visa.", 403);
}

async function getMyVisaChecklist(studentUserId) {
  const application = await findActiveVisaApplicationForStudent(studentUserId);
  if (!application) return { application: null, checklist: [] };
  const checklist = await getVisaChecklist(application.country_id, studentUserId);
  return { application: { id: application.id, countryName: application.country_name, visaStatus: application.visa_status }, checklist };
}

async function uploadVisaDocument(studentUserId, requirementId, fileBase64, originalFilename) {
  const trimmedReqId = String(requirementId || "").trim();
  if (!trimmedReqId) throw fail("Document manquant.", 400);
  if (!fileBase64 || typeof fileBase64 !== "string") throw fail("Aucun fichier fourni.", 400);

  const application = await findActiveVisaApplicationForStudent(studentUserId);
  if (!application) throw fail("Aucun dossier visa actif.", 404);

  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(application.country_id);
  const requirement = requirements.find((r) => r.id === trimmedReqId);
  if (!requirement) throw fail("Ce document ne fait pas partie de votre checklist visa actuelle.", 404);

  const match = fileBase64.match(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/);
  if (!match) throw fail("Format de fichier non supporté (image ou PDF uniquement).", 400);
  const mimeType = match[1];
  const isPdf = mimeType === "application/pdf";
  if (requirement.accepted_file_types === "IMAGE" && isPdf) throw fail("Ce document doit être une image.", 400);
  if (requirement.accepted_file_types === "PDF" && !isPdf) throw fail("Ce document doit être un PDF.", 400);

  const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw fail("Le fichier est invalide ou dépasse 5 Mo.", 400);
  }

  const ext = isPdf ? "pdf" : (mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1]);
  fs.mkdirSync(DOC_DIR, { recursive: true });
  const storedFilename = `visadoc_${studentUserId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(DOC_DIR, path.basename(storedFilename)), buffer);
  const fileUrl = `/uploads/documents/${storedFilename}`;

  await studentDocRepo.upsertForRequirementIds(studentUserId, [requirement.id], {
    fileUrl,
    originalFilename: originalFilename ? String(originalFilename).slice(0, 255) : null,
    storedFilename,
    mimeType,
    fileSize: buffer.length
  });

  const checklist = await getVisaChecklist(application.country_id, studentUserId);
  return checklist.find((d) => d.requirementId === requirement.id);
}

async function getVisaChecklistForApplication(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertVisaDocAccess(auth, application);
  return getVisaChecklist(application.country_id, application.student_id);
}

// Validation / rejet par le RDV assigné à cette candidature (ou Admin).
async function reviewVisaDocument(auth, applicationId, requirementId, status, reason) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertVisaDocAccess(auth, application);

  if (!["VALIDATED", "REJECTED"].includes(status)) throw fail("Statut invalide.", 400);
  const trimmedReason = String(reason || "").trim();
  if (status === "REJECTED" && !trimmedReason) throw fail("Un motif est obligatoire pour refuser un document.", 400);

  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(application.country_id);
  const requirement = requirements.find((r) => r.id === requirementId);
  if (!requirement) throw fail("Document introuvable pour ce dossier.", 404);

  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(application.student_id, [requirement.id]);
  if (!existing.some((d) => d.file_url)) throw fail("Aucun fichier n’a encore été déposé pour ce document.", 400);

  await studentDocRepo.updateStatusForRequirementIds(
    application.student_id,
    [requirement.id],
    status,
    auth.sub,
    status === "REJECTED" ? trimmedReason : null
  );

  if (application.assigned_rdv_id) {
    const body = status === "REJECTED"
      ? `Document visa « ${requirement.name} » refusé : ${trimmedReason}. Merci de le redéposer dans votre espace Documents visa.`
      : `Document visa « ${requirement.name} » validé ✓`;
    const conversation = await messageRepo.createPair(application.student_id, application.assigned_rdv_id);
    await messageRepo.insertMessage(conversation.id, null, body);
  }

  const checklist = await getVisaChecklist(application.country_id, application.student_id);
  return checklist.find((d) => d.requirementId === requirement.id);
}

module.exports = {
  getChecklist,
  getChecklistFor,
  uploadDocument,
  reviewDocument,
  getMyVisaChecklist,
  uploadVisaDocument,
  getVisaChecklistForApplication,
  reviewVisaDocument
};
