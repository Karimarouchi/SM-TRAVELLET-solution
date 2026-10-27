const fs = require("fs");
const path = require("path");
const studentDocRepo = require("../repositories/studentDocumentRepository");
const studentRepo = require("../repositories/studentRepository");
const appRepo = require("../repositories/universityApplicationRepository");
const choiceRepo = require("../repositories/universityChoiceRepository");
const translationRepo = require("../repositories/translationRepository");
const userRepo = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const { canAccessStudent, handlesApplication, authRoles } = require("../security/rbac");
const { canViewStudent } = require("../security/studentView");
const universityApplicationService = require("./universityApplicationService");
const logger = require("../logger");

const DOC_DIR = path.join(__dirname, "../../uploads/documents");
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB, cohérent avec les autres uploads du projet

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function studentName(studentId) {
  const student = await userRepo.findById(studentId);
  return student ? `${student.prenom} ${student.nom}` : "Un étudiant";
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

// Les fichiers déposés ne sont plus servis en accès libre (/uploads) : le
// lien passe par une route qui vérifie qui consulte le document.
function protectedFileUrl(row) {
  if (!row || !row.file_url) return null;
  const filename = path.basename(row.stored_filename || row.file_url);
  return `/api/documents/files/${encodeURIComponent(filename)}`;
}

async function getDocumentFile(auth, rawFilename) {
  const filename = path.basename(String(rawFilename || ""));
  if (!/^[\w.-]+$/.test(filename)) throw fail("Document introuvable.", 404);

  const file = await studentDocRepo.findFileForAccess(filename, auth.sub);
  if (!file) throw fail("Document introuvable.", 404);

  const allowed =
    canAccessStudent(auth, file.student_id, file.assigned_sales_id) ||
    (authRoles(auth).includes("RDV") && file.rdv_assigned);
  if (!allowed) throw fail("Vous n'avez pas accès à ce document.", 403);

  const absolutePath = path.join(DOC_DIR, filename);
  if (!fs.existsSync(absolutePath)) throw fail("Le fichier n'existe plus sur le serveur.", 404);
  return { absolutePath, mimeType: file.mime_type, originalFilename: file.original_filename || filename };
}

// Ouverture par lien signé (droits déjà vérifiés à la création du lien, voir fileLink).
async function getDocumentFileUnchecked(rawFilename) {
  const filename = path.basename(String(rawFilename || ""));
  if (!/^[\w.-]+$/.test(filename)) throw fail("Document introuvable.", 404);
  const file = await studentDocRepo.findFileForAccess(filename, null);
  if (!file) throw fail("Document introuvable.", 404);
  const absolutePath = path.join(DOC_DIR, filename);
  if (!fs.existsSync(absolutePath)) throw fail("Le fichier n'existe plus sur le serveur.", 404);
  return { absolutePath, mimeType: file.mime_type, originalFilename: file.original_filename || filename };
}

// Traduction demandée pour un document validé : champ supplémentaire à remplir (étudiant ou conseiller).
function translationDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    fileUrl: protectedFileUrl(row),
    originalFilename: row.original_filename,
    rejectionReason: row.rejection_reason,
    requestedAt: row.requested_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at
  };
}

function mergedDto(name, group, studentDocsByReqId) {
  const representative = group.map((g) => studentDocsByReqId.get(g.id)).find(Boolean) || null;
  return {
    name,
    universityId: group[0].university_id || null,
    universityName: group[0].university_name || null,
    description: group[0].description,
    required: group.some((g) => g.required),
    acceptedFileTypes: intersectAcceptedFileTypes(group),
    countries: group.map((g) => g.country_name),
    status: representative ? representative.status : "PENDING",
    fileUrl: protectedFileUrl(representative),
    originalFilename: representative ? representative.original_filename : null,
    rejectionReason: representative ? representative.rejection_reason : null,
    submittedAt: representative ? representative.submitted_at : null,
    reviewedAt: representative ? representative.reviewed_at : null
  };
}

// Documents propres aux universités que l'étudiant vise en ce moment.
async function universityRequirementsFor(studentUserId) {
  const choices = await choiceRepo.listActiveForStudent(studentUserId);
  const universityIds = [...new Set(choices.map((c) => c.university_id))];
  return studentDocRepo.findActiveRequirementsByUniversityIds(universityIds);
}

// Documents d'un même nom, dans le bon périmètre : communs au pays
// (universityId absent) ou propres à une université visée.
async function requirementGroup(studentUserId, profile, name, universityId) {
  if (universityId) {
    const requirements = await universityRequirementsFor(studentUserId);
    return requirements.filter((r) => r.name === name && r.university_id === universityId);
  }
  const requirements = await studentDocRepo.findActiveRequirementsByCountryNames(profile?.preferred_countries || []);
  return requirements.filter((r) => r.name === name);
}

async function getChecklist(studentUserId) {
  await universityApplicationService.checkAndAdvanceReadyToApply(studentUserId).catch((err) => {
    logger.error("Échec du calcul READY_TO_APPLY", { message: err.message, stack: err.stack });
  });
  const profile = await studentRepo.findByUserId(studentUserId);
  const preferredCountries = profile?.preferred_countries || [];
  if (!preferredCountries.length) return [];

  const countryRequirements = await studentDocRepo.findActiveRequirementsByCountryNames(preferredCountries);
  const universityRequirements = await universityRequirementsFor(studentUserId);
  if (!countryRequirements.length && !universityRequirements.length) return [];

  const reqIds = [...countryRequirements, ...universityRequirements].map((r) => r.id);
  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(studentUserId, reqIds);
  const byReqId = new Map(existing.map((d) => [d.document_requirement_id, d]));

  const items = Array.from(groupByName(countryRequirements).entries()).map(([name, group]) => mergedDto(name, group, byReqId));
  // Un document propre à une université n'est jamais fusionné avec un autre.
  for (const r of universityRequirements) items.push(mergedDto(r.name, [r], byReqId));

  const translations = new Map((await translationRepo.listForStudent(studentUserId)).map((t) => [`${t.university_id || ""}:${t.doc_name}`, t]));
  for (const item of items) item.translation = translationDto(translations.get(`${item.universityId || ""}:${item.name}`));
  return items;
}

function findItem(checklist, name, universityId) {
  return checklist.find((d) => d.name === name && (d.universityId || null) === (universityId || null));
}

async function uploadDocument(studentUserId, name, fileBase64, originalFilename, universityId = null, options = {}) {
  const trimmedName = String(name || "").trim();
  if (!trimmedName) throw fail("Nom de document manquant.", 400);
  if (!fileBase64 || typeof fileBase64 !== "string") throw fail("Aucun fichier fourni.", 400);

  const profile = await studentRepo.findByUserId(studentUserId);
  const preferredCountries = profile?.preferred_countries || [];
  if (!preferredCountries.length) throw fail("Aucun pays préféré sélectionné.", 400);

  const group = await requirementGroup(studentUserId, profile, trimmedName, universityId || null);
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

  if (profile?.assigned_sales_id && !options.silent) {
    await notificationService.notify(profile.assigned_sales_id, {
      type: "DOCUMENT_UPLOADED",
      title: "Document déposé à vérifier",
      body: `${await studentName(studentUserId)} a déposé « ${trimmedName} ».`,
      link: `/conseiller/etudiants/${studentUserId}`
    });
  }

  const checklist = await getChecklist(studentUserId);
  return findItem(checklist, trimmedName, universityId);
}

// Le conseiller de l'étudiant (ou l'admin) dépose un document à sa place, une fois l'onboarding terminé :
// le document est validé automatiquement et peut remplacer un fichier existant (même refusé).
async function uploadDocumentForStudent(auth, studentId, name, fileBase64, originalFilename, universityId = null) {
  const roles = authRoles(auth);
  if (!roles.includes("SALES") && !roles.includes("ADMIN")) {
    throw fail("Seul le conseiller de l'étudiant ou un administrateur peut déposer un document à sa place.", 403);
  }
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  if (!profile.onboarding_completed) {
    throw fail("L'étudiant doit d'abord terminer son onboarding (pays et projet d'études) avant d'ajouter ses documents.", 409);
  }

  await uploadDocument(studentId, name, fileBase64, originalFilename, universityId, { silent: true });

  const trimmedName = String(name || "").trim();
  const fresh = await studentRepo.findByUserId(studentId);
  const group = await requirementGroup(studentId, fresh, trimmedName, universityId || null);
  await studentDocRepo.updateStatusForRequirementIds(studentId, group.map((g) => g.id), "VALIDATED", auth.sub, null);

  await notificationService.notify(studentId, {
    type: "DOCUMENT_VALIDATED",
    title: `Document ajouté et validé : ${trimmedName}`,
    body: "Votre conseiller a ajouté ce document à votre dossier.",
    link: "/documents"
  });
  await universityApplicationService.checkAndAdvanceReadyToApply(studentId).catch((err) => {
    logger.error("Échec du calcul READY_TO_APPLY", { message: err.message, stack: err.stack });
  });

  const checklist = await getChecklist(studentId);
  return findItem(checklist, trimmedName, universityId);
}

async function getChecklistFor(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!(await canViewStudent(auth, studentId, profile.assigned_sales_id))) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return getChecklist(studentId);
}

// Validation / rejet par Sales (assigné) ou Admin. S'applique à tous les
// document_requirements fusionnés sous ce nom (mêmes règles que l'upload).
async function reviewDocument(auth, studentId, name, status, reason, universityId = null) {
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
  const group = await requirementGroup(studentId, profile, trimmedName, universityId || null);
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

  await notificationService.notify(studentId, status === "REJECTED"
    ? {
        type: "DOCUMENT_REJECTED",
        title: `Document refusé : ${trimmedName}${group[0].university_name ? ` (${group[0].university_name})` : ""}`,
        body: `${trimmedReason}. Merci de le redéposer dans votre espace Documents.`,
        link: "/documents"
      }
    : {
        type: "DOCUMENT_VALIDATED",
        title: `Document validé : ${trimmedName}`,
        body: "Votre document a été vérifié et accepté.",
        link: "/documents"
      });

  if (status === "VALIDATED") {
    // Ne bloque jamais la validation du document si le calcul READY_TO_APPLY
    // échoue pour une raison quelconque (ex: université non reconnue).
    await universityApplicationService.checkAndAdvanceReadyToApply(studentId).catch((err) => {
      logger.error("Échec du calcul READY_TO_APPLY", { message: err.message, stack: err.stack });
    });
  }

  const checklist = await getChecklist(studentId);
  return findItem(checklist, trimmedName, universityId);
}

// Le Responsable Dossier peut refuser un document déjà validé par le conseiller, tant que la
// candidature n'est pas déposée : le document repasse « refusé » avec son motif, l'étudiant et le
// conseiller sont prévenus, et le conseiller fait redéposer un autre document.
async function rejectDocumentAsRdv(auth, studentId, name, reason, universityId = null) {
  if (!authRoles(auth).includes("RDV")) throw fail("Action réservée au Responsable Dossier.", 403);
  const trimmedReason = String(reason || "").trim();
  if (!trimmedReason) throw fail("Indiquez le motif du refus.", 400);
  if (trimmedReason.length > 500) throw fail("Le motif est trop long (500 caractères maximum).", 400);

  const readyApps = await appRepo.listReadyForRdv(auth.sub, studentId);
  if (!readyApps.length) {
    throw fail("Vous pouvez refuser un document tant que la candidature de cet étudiant (qui vous est affectée) n'est pas déposée.", 403);
  }

  const profile = await studentRepo.ensureProfile(studentId);
  const trimmedName = String(name || "").trim();
  const group = await requirementGroup(studentId, profile, trimmedName, universityId || null);
  if (!group.length) throw fail("Document introuvable pour ce dossier.", 404);
  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(studentId, group.map((g) => g.id));
  if (!existing.some((d) => d.file_url)) throw fail("Aucun fichier n’a encore été déposé pour ce document.", 400);
  if (!existing.some((d) => d.status === "VALIDATED")) throw fail("Seul un document validé par le conseiller peut être refusé ici.", 409);

  await studentDocRepo.updateStatusForRequirementIds(studentId, group.map((g) => g.id), "REJECTED", auth.sub, trimmedReason);

  const [student, rdv] = await Promise.all([userRepo.findById(studentId), userRepo.findById(auth.sub)]);
  const studentName = student ? `${student.prenom} ${student.nom}`.trim() : "L'étudiant";
  const rdvName = rdv ? `${rdv.prenom} ${rdv.nom}`.trim() : "Le Responsable Dossier";
  const label = `${trimmedName}${group[0].university_name ? ` (${group[0].university_name})` : ""}`;

  for (const app of readyApps) {
    await appRepo.addHistory({
      applicationId: app.id,
      studentId,
      oldStatus: app.status,
      newStatus: app.status,
      changedBy: auth.sub,
      comment: `Document refusé par le Responsable Dossier : ${label} — ${trimmedReason}`
    });
  }

  await notificationService.notify(studentId, {
    type: "DOCUMENT_REJECTED",
    title: `Document refusé : ${label}`,
    body: `${trimmedReason}. Merci de le redéposer dans votre espace Documents.`,
    link: "/documents"
  });
  if (profile.assigned_sales_id) {
    await notificationService.notify(profile.assigned_sales_id, {
      type: "DOCUMENT_REJECTED_BY_RDV",
      title: `Document refusé par le Responsable Dossier : ${label}`,
      body: `${studentName} : ${rdvName} a refusé ce document (${trimmedReason}). Faites redéposer un autre document ; le dossier sera à revalider.`,
      link: `/conseiller/etudiants/${studentId}`
    });
  }

  const checklist = await getChecklist(studentId);
  return findItem(checklist, trimmedName, universityId);
}

// -------------------------------------------------------------------------
// Documents VISA — une liste par pays, fixée par le Responsable Dossier.
// Le conseiller ou l'étudiant dépose le PDF. Le conseiller valide.
// Ensuite seulement, le Responsable Dossier peut refuser un document déjà
// validé, avec un motif. Le dossier reste chez lui.
// -------------------------------------------------------------------------

function visaDto(requirement, studentDoc) {
  return {
    requirementId: requirement.id,
    name: requirement.name,
    description: requirement.description,
    required: requirement.required,
    acceptedFileTypes: requirement.accepted_file_types,
    status: studentDoc ? studentDoc.status : "PENDING",
    fileUrl: protectedFileUrl(studentDoc),
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
  return rows.find((r) => r.status === "ACCEPTED" && r.visa_status !== "ACCEPTED" && r.visa_status !== "REJECTED") || null;
}

function assertVisaDocAccess(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  // Le conseiller qui a déposé le dossier et le Responsable Dossier qui le reprend
  // voient tous les deux les documents visa, y compris après l'acceptation.
  if (handlesApplication(auth, application, "SALES")) return;
  if (handlesApplication(auth, application, "RDV")) return;
  throw fail("Vous n’avez pas accès à ce dossier visa.", 403);
}

function assertSalesFilesVisa(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  if (handlesApplication(auth, application, "SALES")) return;
  throw fail("Seul le conseiller dépose les fichiers des documents visa.", 403);
}

function assertVisaFileStillOpen(application) {
  if (application.status !== "ACCEPTED" || ["SUBMITTED", "ACCEPTED", "REJECTED"].includes(application.visa_status)) {
    throw fail("Ce dossier visa n'accepte plus de nouveaux documents.", 409);
  }
}

// Une fois le dossier chez le Responsable Dossier, un fichier déjà validé
// ne se remplace qu'après son refus.
async function assertReplacementAllowed(application, requirementId) {
  if (!application.visa_status) return;
  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(application.student_id, [requirementId]);
  const current = existing.find((d) => d.file_url);
  if (current && current.status === "VALIDATED") {
    throw fail("Ce document est déjà validé. Le Responsable Dossier peut le refuser s'il ne convient pas.", 409);
  }
}

function visaAppointmentAt(application) {
  const dates = [application?.visa_embassy_appointment_at, application?.visa_prep_meeting_at].filter(Boolean).map((value) => new Date(value));
  const upcoming = dates.filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
  return upcoming[0] || null;
}

function assertVisaAppointment(application) {
  if (!visaAppointmentAt(application)) {
    throw fail("Les documents visa se déposent une fois le rendez-vous fixé par le Responsable Dossier.", 409);
  }
}

async function getMyVisaChecklist(studentUserId) {
  const application = await findActiveVisaApplicationForStudent(studentUserId);
  if (!application) return { application: null, checklist: [] };
  const checklist = await getVisaChecklist(application.country_id, studentUserId);
  const appointment = visaAppointmentAt(application);
  return {
    application: {
      id: application.id,
      countryName: application.country_name,
      visaStatus: application.visa_status,
      uploadsOpen: Boolean(appointment),
      appointmentAt: appointment ? appointment.toISOString() : null
    },
    checklist
  };
}

async function storeVisaFile(studentUserId, requirement, fileBase64, originalFilename) {
  if (!fileBase64 || typeof fileBase64 !== "string") throw fail("Aucun fichier fourni.", 400);
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
}

async function uploadVisaDocument(studentUserId, requirementId, fileBase64, originalFilename) {
  const trimmedReqId = String(requirementId || "").trim();
  if (!trimmedReqId) throw fail("Document manquant.", 400);
  if (!fileBase64 || typeof fileBase64 !== "string") throw fail("Aucun fichier fourni.", 400);

  const application = await findActiveVisaApplicationForStudent(studentUserId);
  if (!application) throw fail("Aucun dossier visa actif.", 404);
  assertVisaAppointment(application);
  assertVisaFileStillOpen(application);

  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(application.country_id);
  const requirement = requirements.find((r) => r.id === trimmedReqId);
  if (!requirement) throw fail("Ce document ne fait pas partie de votre checklist visa actuelle.", 404);
  await assertReplacementAllowed(application, requirement.id);

  await storeVisaFile(studentUserId, requirement, fileBase64, originalFilename);

  if (application.sales_id) {
    await notificationService.notify(application.sales_id, {
      type: "VISA_DOCUMENT_UPLOADED",
      title: "Document visa déposé à vérifier",
      body: `${await studentName(studentUserId)} a déposé « ${requirement.name} » (${application.country_name || "visa"}).`,
      link: `/conseiller/etudiants/${studentUserId}`
    });
  }

  const checklist = await getVisaChecklist(application.country_id, studentUserId);
  return checklist.find((d) => d.requirementId === requirement.id);
}

// Le conseiller dépose un document visa à la place de l'étudiant : validé directement.
// Le Responsable Dossier ne dépose pas de fichier.
async function uploadVisaDocumentForStudent(auth, applicationId, requirementId, fileBase64, originalFilename) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertSalesFilesVisa(auth, application);
  assertVisaAppointment(application);
  assertVisaFileStillOpen(application);

  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(application.country_id);
  const requirement = requirements.find((r) => r.id === String(requirementId || "").trim());
  if (!requirement) throw fail("Ce document ne fait pas partie de la checklist visa de ce dossier.", 404);
  await assertReplacementAllowed(application, requirement.id);

  await storeVisaFile(application.student_id, requirement, fileBase64, originalFilename);
  await studentDocRepo.updateStatusForRequirementIds(application.student_id, [requirement.id], "VALIDATED", auth.sub, null);

  await notificationService.notify(application.student_id, {
    type: "VISA_DOCUMENT_VALIDATED",
    title: `Document visa ajouté et validé : ${requirement.name}`,
    body: "Votre dossier visa a été complété par l'équipe SM Travel.",
    link: "/documents?tab=visa"
  });
  await universityApplicationService.maybeAdvanceVisaAfterDocs(application.id);

  const checklist = await getVisaChecklist(application.country_id, application.student_id);
  return checklist.find((d) => d.requirementId === requirement.id);
}

function studyDocumentDto(row) {
  return {
    id: row.id,
    name: row.name,
    originalFilename: row.original_filename,
    universityName: row.university_name || null,
    status: row.status
  };
}

async function listStudyDocumentsForApplication(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertVisaDocAccess(auth, application);
  const rows = await studentDocRepo.listFiledStudyDocuments(application.student_id);
  return rows.map(studyDocumentDto);
}

// Le conseiller reconnaît qu'un document déjà déposé pour l'université est le même
// que celui demandé pour le visa. Le fichier est repris, sans nouvel envoi de l'étudiant.
async function reuseStudyDocumentForVisa(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertSalesFilesVisa(auth, application);
  assertVisaAppointment(application);
  assertVisaFileStillOpen(application);

  const source = await studentDocRepo.findFiledStudyDocument(application.student_id, String(payload?.sourceDocumentId || ""));
  if (!source) throw fail("Ce document déjà déposé est introuvable.", 404);
  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(application.country_id);
  const requirement = requirements.find((row) => row.id === String(payload?.requirementId || "").trim());
  if (!requirement) throw fail("Ce document ne fait pas partie de la checklist visa de ce dossier.", 404);
  await assertReplacementAllowed(application, requirement.id);

  await studentDocRepo.upsertForRequirementIds(application.student_id, [requirement.id], {
    fileUrl: source.file_url,
    originalFilename: source.original_filename,
    storedFilename: source.stored_filename,
    mimeType: source.mime_type,
    fileSize: source.file_size
  });
  await studentDocRepo.updateStatusForRequirementIds(application.student_id, [requirement.id], "VALIDATED", auth.sub, null);
  await universityApplicationService.maybeAdvanceVisaAfterDocs(application.id);
  const checklist = await getVisaChecklist(application.country_id, application.student_id);
  return checklist.find((item) => item.requirementId === requirement.id);
}

async function getVisaChecklistForApplication(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertVisaDocAccess(auth, application);
  return getVisaChecklist(application.country_id, application.student_id);
}

// Le conseiller valide (ou refuse) un fichier déposé par l'étudiant, y compris
// quand le dossier est déjà chez le Responsable Dossier.
// Le Responsable Dossier, une fois le dossier chez lui, refuse seulement un
// document déjà validé, avec un motif. L'étudiant n'est pas notifié : le
// conseiller le contacte et redépose le fichier.
async function reviewVisaDocument(auth, applicationId, requirementId, status, reason) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  if (application.status !== "ACCEPTED" || ["SUBMITTED", "ACCEPTED", "REJECTED"].includes(application.visa_status)) {
    throw fail("Ce dossier visa n'accepte plus de changement sur les documents.", 409);
  }

  if (!["VALIDATED", "REJECTED"].includes(status)) throw fail("Statut invalide.", 400);
  const trimmedReason = String(reason || "").trim();
  if (status === "REJECTED" && !trimmedReason) throw fail("Un motif est obligatoire pour refuser un document.", 400);
  if (trimmedReason.length > 500) throw fail("Le motif est trop long (500 caractères maximum).", 400);

  const requirements = await studentDocRepo.findActiveVisaRequirementsByCountryId(application.country_id);
  const requirement = requirements.find((r) => r.id === requirementId);
  if (!requirement) throw fail("Document introuvable pour ce dossier.", 404);

  const existing = await studentDocRepo.findStudentDocumentsByRequirementIds(application.student_id, [requirement.id]);
  const current = existing.find((d) => d.file_url);
  if (!current) throw fail("Aucun fichier n’a encore été déposé pour ce document.", 400);

  const roles = authRoles(auth);
  const isAdmin = roles.includes("ADMIN");
  const isRdv = handlesApplication(auth, application, "RDV");
  const isSales = handlesApplication(auth, application, "SALES");
  const officerReject = status === "REJECTED"
    && current.status === "VALIDATED"
    && application.visa_status === "PREPARATION"
    && (isRdv || isAdmin);

  if (status === "REJECTED" && current.status === "VALIDATED") {
    if (!officerReject) {
      throw fail("Seul le Responsable Dossier peut refuser un document visa déjà validé, pendant la préparation du visa.", 403);
    }
  } else if (!(isSales || isAdmin)) {
    throw fail("La validation des documents visa est réservée au conseiller.", 403);
  } else if (status === "REJECTED" && application.visa_status && current.status !== "SUBMITTED") {
    throw fail("Une fois le dossier chez le Responsable Dossier, seul lui peut refuser un document déjà validé.", 403);
  } else if (status === "VALIDATED" && !["SUBMITTED", "REJECTED", "VALIDATED"].includes(current.status)) {
    throw fail("Ce document n'est pas en attente de validation.", 409);
  }

  await studentDocRepo.updateStatusForRequirementIds(
    application.student_id,
    [requirement.id],
    status,
    auth.sub,
    status === "REJECTED" ? trimmedReason : null
  );

  if (officerReject) {
    await appRepo.addHistory({
      applicationId: application.id,
      studentId: application.student_id,
      oldStatus: application.status,
      newStatus: application.status,
      changedBy: auth.sub,
      comment: `Document visa refusé par le Responsable Dossier : ${requirement.name} — ${trimmedReason}`
    });
    if (application.sales_id) {
      await notificationService.notify(application.sales_id, {
        type: "VISA_DOCUMENT_REJECTED_BY_RDV",
        title: `Document visa refusé : ${requirement.name}`,
        body: `${await studentName(application.student_id)} : le Responsable Dossier a refusé ce document (${trimmedReason}). Contactez l'étudiant et déposez le nouveau fichier. Le dossier reste chez le Responsable Dossier.`,
        link: `/conseiller/etudiants/${application.student_id}`
      });
    }
  } else if (status === "REJECTED") {
    await notificationService.notify(application.student_id, {
      type: "VISA_DOCUMENT_REJECTED",
      title: `Document visa refusé : ${requirement.name}`,
      body: `${trimmedReason}. Merci de le redéposer dans votre espace Documents visa.`,
      link: "/documents?tab=visa"
    });
  } else {
    await notificationService.notify(application.student_id, {
      type: "VISA_DOCUMENT_VALIDATED",
      title: `Document visa validé : ${requirement.name}`,
      body: "Votre document visa a été vérifié et accepté.",
      link: "/documents?tab=visa"
    });
  }

  await universityApplicationService.maybeAdvanceVisaAfterDocs(application.id);
  const checklist = await getVisaChecklist(application.country_id, application.student_id);
  return checklist.find((d) => d.requirementId === requirement.id);
}

module.exports = {
  translationDto,
  protectedFileUrl,
  getDocumentFile,
  getDocumentFileUnchecked,
  getChecklist,
  getChecklistFor,
  uploadDocument,
  reviewDocument,
  rejectDocumentAsRdv,
  uploadDocumentForStudent,
  getMyVisaChecklist,
  uploadVisaDocument,
  uploadVisaDocumentForStudent,
  getVisaChecklistForApplication,
  listStudyDocumentsForApplication,
  reuseStudyDocumentForVisa,
  reviewVisaDocument
};
