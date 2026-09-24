const appRepo = require("../repositories/universityApplicationRepository");
const countryRepo = require("../repositories/countryRepository");
const universityRepo = require("../repositories/countryUniversityRepository");
const studentDocRepo = require("../repositories/studentDocumentRepository");
const studentRepo = require("../repositories/studentRepository");
const userRepo = require("../repositories/userRepository");
const userRoleRepo = require("../repositories/userRoleRepository");
const messageRepo = require("../repositories/messageRepository");
const emailService = require("./emailService");
const commissionService = require("./commissionService");
const logger = require("../logger");
const { canAccessStudent, canAccessApplication, authRoles } = require("../security/rbac");

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dto(row) {
  if (!row) return null;
  return {
    id: row.id,
    studentId: row.student_id,
    countryId: row.country_id,
    countryName: row.country_name,
    universityId: row.university_id,
    universityName: row.university_name,
    programmeId: row.programme_id,
    programmeTitle: row.programme_title || null,
    salesId: row.sales_id,
    assignedRdvId: row.assigned_rdv_id,
    status: row.status,
    appliedAt: row.applied_at,
    applicationReference: row.application_reference,
    notes: row.notes,
    interviewDate: row.interview_date,
    interviewType: row.interview_type,
    interviewLink: row.interview_link,
    interviewInstructions: row.interview_instructions,
    decisionAt: row.decision_at,
    decisionReason: row.decision_reason,
    acceptanceReference: row.acceptance_reference,
    visaStatus: row.visa_status,
    visaSubmittedAt: row.visa_submitted_at,
    visaDecisionAt: row.visa_decision_at,
    visaDecisionReason: row.visa_decision_reason,
    visaPrepMeetingAt: row.visa_prep_meeting_at,
    visaPrepMeetingType: row.visa_prep_meeting_type,
    visaPrepMeetingLocation: row.visa_prep_meeting_location,
    visaPrepMeetingInstructions: row.visa_prep_meeting_instructions,
    visaEmbassyAppointmentAt: row.visa_embassy_appointment_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function recordHistory(applicationId, studentId, oldStatus, newStatus, changedBy, comment) {
  await appRepo.addHistory({ applicationId, studentId, oldStatus, newStatus, changedBy, comment });
}

// Appelée après chaque validation de document (studentDocumentService).
// Pour chaque pays préféré de l'étudiant dont TOUS les documents obligatoires
// et actifs sont VALIDATED, crée automatiquement une candidature
// READY_TO_APPLY (si aucune candidature active n'existe déjà pour ce pays)
// et fait passer le dossier global en phase UNIVERSITY_APPLICATION.
// N'écrase jamais une candidature existante.
async function checkAndAdvanceReadyToApply(studentId) {
  const profile = await studentRepo.findByUserId(studentId);
  if (!profile) return;
  const preferredCountries = profile.preferred_countries || [];
  if (!preferredCountries.length) return;

  let anyReady = false;

  for (const countryName of preferredCountries) {
    const country = await countryRepo.findByNameCaseInsensitive(countryName);
    if (!country || !country.active) continue;

    const statuses = await studentDocRepo.findRequiredActiveStatusesForCountry(country.id, studentId);
    if (!statuses.length) continue; // aucun document obligatoire configuré : pas de vérité à constater
    const allValidated = statuses.every((s) => s.status === "VALIDATED");
    if (!allValidated) continue;

    anyReady = true;

    if (profile.assigned_sales_id) {
      await commissionService.awardCommission({
        userId: profile.assigned_sales_id,
        studentId,
        countryId: country.id,
        role: "SALES",
        stage: "DOCUMENTS_VALIDATED"
      });
    }

    const activeApplications = await appRepo.findActiveForStudent(studentId);
    const alreadyHasApplicationForCountry = activeApplications.some((a) => a.country_id === country.id);
    if (alreadyHasApplicationForCountry) continue;

    // Résout l'université choisie par l'étudiant (target_university, saisi à
    // l'onboarding depuis la liste Admin) pour ce pays précis.
    if (!profile.target_university) continue;
    const university = await universityRepo.findByCountryAndName(country.id, profile.target_university);
    if (!university) continue; // université non reconnue pour ce pays : le Sales créera la candidature manuellement

    const created = await appRepo.create({
      studentId,
      countryId: country.id,
      universityId: university.id,
      salesId: profile.assigned_sales_id
    });
    await recordHistory(created.id, studentId, null, "READY_TO_APPLY", null, "Documents validés — dossier prêt à postuler (automatique).");
  }

  if (anyReady && profile.dossier_stage === "DOCUMENTS") {
    await studentRepo.setDossierStage(studentId, "UNIVERSITY_APPLICATION");
  }
}

async function listForStudent(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  const rows = await appRepo.listForStudent(studentId);
  return rows.map(dto);
}

async function getHistoryForStudent(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return appRepo.listHistoryForStudent(studentId);
}

async function assertApplicationAccess(auth, application) {
  if (application.sales_id) {
    if (!canAccessApplication(auth, application.sales_id, application.assigned_rdv_id)) {
      throw fail("Vous n’avez pas accès à cette candidature.", 403);
    }
    return;
  }
  const profile = await studentRepo.ensureProfile(application.student_id);
  if (!canAccessStudent(auth, application.student_id, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à cette candidature.", 403);
  }
}

function assertSalesOrAdmin(auth) {
  if (auth.role !== "SALES" && auth.role !== "ADMIN") {
    throw fail("Action réservée au conseiller ou à l’administrateur.", 403);
  }
}

// L'entretien terminé peut être déclaré par le Sales/Admin, ou par
// l'étudiant lui-même une fois l'entretien passé (dossier lui appartenant).
function assertSalesAdminOrOwnerStudent(auth, application) {
  if (auth.role === "SALES" || auth.role === "ADMIN") return;
  if (auth.role === "STUDENT" && auth.sub === application.student_id) return;
  throw fail("Action non autorisée.", 403);
}

// Le dossier visa n'est géré que par le RDV assigné à CETTE candidature (pas
// n'importe quel RDV) ou par l'Admin — jamais par le Sales.
function assertRdvOrAdmin(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  if (roles.includes("RDV") && application.assigned_rdv_id === auth.sub) return;
  throw fail("Action réservée au Responsable Dossier Visa assigné ou à l’administrateur.", 403);
}

// §5 — Marquer comme candidature déposée. Confirme (ou modifie) l'université
// choisie par l'étudiant, renseigne la date/référence/commentaire.
async function markApplied(auth, applicationId, payload) {
  assertSalesOrAdmin(auth);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  if (application.status !== "READY_TO_APPLY") {
    throw fail("Cette candidature n’est pas au statut « prête à postuler ».", 400);
  }

  let universityId = application.university_id;
  if (payload.universityId && payload.universityId !== universityId) {
    const university = await universityRepo.findById(payload.universityId);
    if (!university || university.country_id !== application.country_id) {
      throw fail("Université invalide pour ce pays.", 400);
    }
    universityId = university.id;
  }

  const appliedAt = payload.appliedAt ? new Date(payload.appliedAt) : new Date();
  if (Number.isNaN(appliedAt.getTime())) throw fail("Date de dépôt invalide.", 400);

  const updated = await appRepo.update(applicationId, {
    university_id: universityId,
    programme_id: payload.programmeId || application.programme_id,
    status: "WAITING_UNIVERSITY_RESPONSE",
    applied_at: appliedAt,
    application_reference: payload.applicationReference ? String(payload.applicationReference).trim() : null,
    notes: payload.notes ? String(payload.notes).trim() : null
  });

  await recordHistory(applicationId, application.student_id, application.status, "WAITING_UNIVERSITY_RESPONSE", auth.sub, "Candidature déposée.");
  await notifyStudent(application, `Votre candidature a été déposée. En attente de la réponse de l'université.`, auth.sub);

  if (application.sales_id) {
    await commissionService.awardCommission({
      userId: application.sales_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "SALES",
      stage: "APPLIED",
      applicationId
    });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

async function notifyStudent(application, body) {
  const profile = await studentRepo.ensureProfile(application.student_id);
  if (!profile.assigned_sales_id) return;
  const conversation = await messageRepo.createPair(application.student_id, profile.assigned_sales_id);
  await messageRepo.insertMessage(conversation.id, null, body);
}

// §7 — Entretien demandé / planifié / modifié.
async function scheduleInterview(auth, applicationId, payload) {
  assertSalesOrAdmin(auth);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  if (!["WAITING_UNIVERSITY_RESPONSE", "INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED"].includes(application.status)) {
    throw fail("Cette candidature n’est pas dans un état permettant de planifier un entretien.", 400);
  }

  const date = payload.interviewDate ? new Date(payload.interviewDate) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Date/heure d’entretien invalide.", 400);
  // Tous les entretiens se font en ligne.
  const type = "ONLINE";
  if (!payload.interviewLink) throw fail("Le lien de l’entretien en ligne est obligatoire.", 400);

  const wasScheduled = application.status === "INTERVIEW_SCHEDULED";
  const updated = await appRepo.update(applicationId, {
    status: "INTERVIEW_SCHEDULED",
    interview_date: date,
    interview_type: type,
    interview_link: String(payload.interviewLink).trim(),
    interview_instructions: payload.instructions ? String(payload.instructions).trim() : null
  });

  await recordHistory(
    applicationId,
    application.student_id,
    application.status,
    "INTERVIEW_SCHEDULED",
    auth.sub,
    wasScheduled ? "Entretien reprogrammé." : "Entretien planifié."
  );
  await notifyStudent(
    application,
    `Un entretien a été ${wasScheduled ? "reprogrammé" : "planifié"} le ${date.toLocaleString("fr-FR")}.`,
    auth.sub
  );

  // Étape importante : l'étudiant doit être prévenu par email en plus du
  // message dans l'application (ne bloque jamais la planification si
  // l'envoi échoue).
  try {
    const student = await userRepo.findById(application.student_id);
    const country = await countryRepo.findById(application.country_id);
    const university = await universityRepo.findById(updated.university_id);
    if (student?.email) {
      await emailService.sendInterviewEmail(student.email, student.prenom, {
        universityName: university?.name || "votre université",
        countryName: country?.name || "",
        dateLabel: date.toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        type,
        link: type === "ONLINE" ? String(payload.interviewLink).trim() : null,
        instructions: payload.instructions ? String(payload.instructions).trim() : null
      });
    }
  } catch (err) {
    logger.error("Échec de l'envoi de l'email d'entretien", { message: err.message, stack: err.stack });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §8 — Entretien terminé.
async function completeInterview(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertSalesAdminOrOwnerStudent(auth, application);
  if (auth.role !== "STUDENT") await assertApplicationAccess(auth, application);
  if (application.status !== "INTERVIEW_SCHEDULED") {
    throw fail("Aucun entretien planifié pour cette candidature.", 400);
  }

  const updated = await appRepo.update(applicationId, { status: "WAITING_UNIVERSITY_RESPONSE" });
  await recordHistory(applicationId, application.student_id, application.status, "WAITING_UNIVERSITY_RESPONSE", auth.sub, "Entretien réalisé — en attente de la décision de l’université.");
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §9 — Acceptation.
async function markAccepted(auth, applicationId, payload) {
  assertSalesOrAdmin(auth);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  if (!["WAITING_UNIVERSITY_RESPONSE", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(application.status)) {
    throw fail("Cette candidature n’est pas dans un état permettant une acceptation.", 400);
  }

  const updated = await appRepo.update(applicationId, {
    status: "ACCEPTED",
    decision_at: new Date(),
    acceptance_reference: payload.reference ? String(payload.reference).trim() : null,
    notes: payload.comment ? String(payload.comment).trim() : application.notes
  });
  await recordHistory(applicationId, application.student_id, application.status, "ACCEPTED", auth.sub, payload.comment || "Étudiant accepté par l’université.");
  await notifyStudent(application, "Félicitations, votre candidature a été acceptée ! Votre dossier passe maintenant à l'étape visa.", auth.sub);

  await studentRepo.setDossierStage(application.student_id, "VISA");

  if (application.sales_id) {
    await commissionService.awardCommission({
      userId: application.sales_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "SALES",
      stage: "ACCEPTED",
      applicationId
    });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §11 — Refus, motif obligatoire.
async function markRejected(auth, applicationId, reason) {
  assertSalesOrAdmin(auth);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  const trimmed = String(reason || "").trim();
  if (!trimmed) throw fail("Un motif est obligatoire pour refuser une candidature.", 400);
  if (["ACCEPTED", "REJECTED", "CLOSED"].includes(application.status)) {
    throw fail("Cette candidature est déjà clôturée.", 400);
  }

  const updated = await appRepo.update(applicationId, {
    status: "REJECTED",
    decision_at: new Date(),
    decision_reason: trimmed
  });
  await recordHistory(applicationId, application.student_id, application.status, "REJECTED", auth.sub, trimmed);
  await notifyStudent(application, `Votre candidature a été refusée par l'université. Motif : ${trimmed}`, auth.sub);
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §12 — Clôturer le parcours (après refus), ne réouvre rien.
async function closeApplication(auth, applicationId, comment) {
  assertSalesOrAdmin(auth);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  if (application.status !== "REJECTED") {
    throw fail("Seule une candidature refusée peut être clôturée.", 400);
  }
  const updated = await appRepo.update(applicationId, { status: "CLOSED" });
  await recordHistory(applicationId, application.student_id, application.status, "CLOSED", auth.sub, comment || "Parcours universitaire clôturé.");
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §12 — Postuler dans une autre université après refus : NE modifie PAS
// l'ancienne candidature (conservée telle quelle), en crée une nouvelle.
async function reapply(auth, applicationId, payload) {
  assertSalesOrAdmin(auth);
  const previous = await appRepo.findById(applicationId);
  if (!previous) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, previous);
  const visaRejected = previous.visa_status === "REJECTED";
  if (previous.status !== "REJECTED" && !visaRejected) {
    throw fail("Une nouvelle candidature ne peut être créée qu’après un refus.", 400);
  }
  if (!payload.universityId) throw fail("Choisissez une université.", 400);
  const university = await universityRepo.findById(payload.universityId);
  if (!university || university.country_id !== previous.country_id) {
    throw fail("Université invalide pour ce pays.", 400);
  }

  const created = await appRepo.create({
    studentId: previous.student_id,
    countryId: previous.country_id,
    universityId: university.id,
    programmeId: payload.programmeId || null,
    salesId: previous.sales_id
  });
  await recordHistory(
    created.id,
    previous.student_id,
    null,
    "READY_TO_APPLY",
    auth.sub,
    visaRejected ? `Nouvelle candidature après refus du visa (${university.name}).` : `Nouvelle candidature après refus (${university.name}).`
  );
  if (visaRejected) {
    await studentRepo.setDossierStage(previous.student_id, "UNIVERSITY_APPLICATION");
  }
  return dto({ ...created, country_name: (await countryRepo.findById(created.country_id))?.name, university_name: university.name });
}

// §10/§16 — Transfert au Responsable Dossier Visa. Le Sales reste associé au
// dossier (jamais retiré) ; le RDV devient responsable des étapes visa.
// Calcule quel RDV recevrait le dossier si on lance le transfert automatique
// maintenant : RDV spécialisé sur ce pays le moins chargé, ou à défaut (aucun
// RDV configuré pour ce pays) le RDV actif le moins chargé toutes destinations
// confondues, pour une répartition équitable. Utilisé pour la confirmation
// affichée au Sales avant transfert, et par assignRdv lui-même.
async function computeRdvSuggestion(countryId) {
  const specialized = await userRoleRepo.findRdvForCountry(countryId);
  if (specialized.length) {
    const pick = specialized[0];
    return { rdvUserId: pick.id, rdvName: `${pick.prenom} ${pick.nom}`.trim(), fallback: false };
  }
  const anyRdv = await userRoleRepo.findLeastLoadedActiveRdv();
  if (!anyRdv.length) return { rdvUserId: null, rdvName: null, fallback: true };
  const pick = anyRdv[0];
  return { rdvUserId: pick.id, rdvName: `${pick.prenom} ${pick.nom}`.trim(), fallback: true };
}

async function suggestRdv(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  return computeRdvSuggestion(application.country_id);
}

async function assignRdv(auth, applicationId, payload) {
  assertSalesOrAdmin(auth);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  await assertApplicationAccess(auth, application);
  if (application.status !== "ACCEPTED") {
    throw fail("Le transfert au Responsable Dossier Visa n’est possible qu’après acceptation.", 400);
  }

  let rdvUserId = payload.rdvUserId || null;
  let fallback = false;
  if (!rdvUserId) {
    // Attribution automatique : RDV spécialisé sur le pays de la candidature,
    // le moins chargé. À défaut (aucun RDV spécialisé), répartition équitable
    // parmi tous les RDV actifs. L'auto-attribution à soi-même est autorisée.
    const suggestion = await computeRdvSuggestion(application.country_id);
    if (!suggestion.rdvUserId) {
      throw fail("Aucun Responsable Dossier Visa actif n'existe. Créez-en un ou choisissez-en un manuellement.", 409);
    }
    rdvUserId = suggestion.rdvUserId;
    fallback = suggestion.fallback;
  } else if (authRoles(auth).includes("ADMIN")) {
    // L'Admin a autorité pour réattribuer librement, y compris vers un RDV
    // non spécialisé sur ce pays (ex: rééquilibrage manuel de la charge).
    const allRdv = await userRoleRepo.listUsersWithRole("RDV");
    if (!allRdv.some((r) => r.id === rdvUserId && r.is_active !== false)) {
      throw fail("Ce compte n'est pas un Responsable Dossier Visa actif.", 400);
    }
  } else {
    const assigned = await userRoleRepo.listRdvAssignmentsForCountry(application.country_id);
    if (assigned.length) {
      if (!assigned.some((r) => r.id === rdvUserId)) {
        const country = await countryRepo.findById(application.country_id);
        throw fail(`Ce RDV n'est pas configuré pour ${country?.name || "ce pays"}.`, 400);
      }
    } else {
      const allRdv = await userRoleRepo.listUsersWithRole("RDV");
      if (!allRdv.some((r) => r.id === rdvUserId && r.is_active !== false)) {
        throw fail("Ce compte n'est pas un Responsable Dossier Visa actif.", 400);
      }
      fallback = true;
    }
  }

  const wasAlreadyAssigned = Boolean(application.assigned_rdv_id);
  const fields = { assigned_rdv_id: rdvUserId };
  // Une réattribution (le dossier avait déjà un RDV et un statut visa en
  // cours) ne remet pas le compteur à zéro : seul le responsable change.
  if (!application.visa_status) fields.visa_status = "PREPARATION";
  const updated = await appRepo.update(applicationId, fields);
  const rdvUser = await userRepo.findById(rdvUserId);
  const rdvName = rdvUser ? `${rdvUser.prenom} ${rdvUser.nom}`.trim() : "Responsable Dossier Visa";
  const comment = wasAlreadyAssigned
    ? `Dossier réattribué à ${rdvName}.`
    : fallback
      ? `Dossier transféré à ${rdvName} — aucun RDV spécialisé pour ce pays, attribution équitable parmi tous les RDV actifs.`
      : `Dossier transféré à ${rdvName} — préparation du visa.`;
  await recordHistory(applicationId, application.student_id, application.status, application.status, auth.sub, comment);
  await studentRepo.setDossierStage(application.student_id, "VISA");
  if (!wasAlreadyAssigned) {
    await notifyStudent(updated, "Votre dossier universitaire est accepté ! Il passe maintenant à l'étape de préparation du visa.", auth.sub);
  }
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// Étape visa 1/3 — le dossier visa est déposé.
async function markVisaSubmitted(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertRdvOrAdmin(auth, application);
  if (application.visa_status !== "PREPARATION") {
    throw fail("Le dossier visa n’est pas en préparation.", 400);
  }

  const requiredStatuses = await studentDocRepo.findRequiredActiveVisaStatusesForCountry(application.country_id, application.student_id);
  const notValidated = requiredStatuses.filter((r) => r.status !== "VALIDATED");
  if (notValidated.length) {
    throw fail("Tous les documents visa obligatoires doivent être validés avant de déposer le dossier.", 400);
  }

  const updated = await appRepo.update(applicationId, { visa_status: "SUBMITTED", visa_submitted_at: new Date() });
  await recordHistory(applicationId, application.student_id, "VISA_PREPARATION", "VISA_SUBMITTED", auth.sub, "Dossier visa déposé.");
  await notifyStudent(updated, "Votre dossier visa a été déposé. En attente de la décision.", auth.sub);

  if (application.assigned_rdv_id) {
    await commissionService.awardCommission({
      userId: application.assigned_rdv_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "RDV",
      stage: "VISA_SUBMITTED",
      applicationId
    });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// Étape visa 2/3 (issue positive) — visa accepté, dossier complet.
async function markVisaAccepted(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertRdvOrAdmin(auth, application);
  if (application.visa_status !== "SUBMITTED") {
    throw fail("Le dossier visa doit être déposé avant de pouvoir être accepté.", 400);
  }

  const comment = payload?.comment ? String(payload.comment).trim() : null;
  const updated = await appRepo.update(applicationId, {
    visa_status: "ACCEPTED",
    visa_decision_at: new Date(),
    visa_decision_reason: comment
  });
  await recordHistory(applicationId, application.student_id, "VISA_SUBMITTED", "VISA_ACCEPTED", auth.sub, comment || "Visa accepté.");
  await notifyStudent(updated, "Félicitations, votre visa a été accepté ! Votre dossier est désormais complet.", auth.sub);
  await studentRepo.setDossierStage(application.student_id, "COMPLETED");

  if (application.assigned_rdv_id) {
    await commissionService.awardCommission({
      userId: application.assigned_rdv_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "RDV",
      stage: "VISA_ACCEPTED",
      applicationId
    });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// Étape visa 2/3 (issue négative) — refus, motif obligatoire, état final :
// le dossier est clôturé (status CLOSED). Un nouvel essai passe par reapply()
// (nouvelle candidature, historique de celle-ci conservé intact).
async function markVisaRejected(auth, applicationId, reason) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertRdvOrAdmin(auth, application);
  const trimmed = String(reason || "").trim();
  if (!trimmed) throw fail("Un motif est obligatoire pour refuser un visa.", 400);
  if (application.visa_status !== "SUBMITTED") {
    throw fail("Le dossier visa doit être déposé avant une décision.", 400);
  }

  const updated = await appRepo.update(applicationId, {
    visa_status: "REJECTED",
    visa_decision_at: new Date(),
    visa_decision_reason: trimmed,
    status: "CLOSED"
  });
  await recordHistory(applicationId, application.student_id, "VISA_SUBMITTED", "VISA_REJECTED", auth.sub, trimmed);
  await notifyStudent(updated, `Votre visa a été refusé. Motif : ${trimmed}. Une nouvelle candidature peut être ouverte si vous le souhaitez.`, auth.sub);
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// §Visa — le RDV planifie une réunion de préparation à l'entretien visa
// (en ligne ou en présentiel), une fois le dossier visa déposé (donc les
// documents obligatoires déjà validés). Peut être reprogrammée librement.
async function scheduleVisaPrepMeeting(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertRdvOrAdmin(auth, application);
  if (!application.visa_status || application.visa_status === "PREPARATION") {
    throw fail("Le dossier visa doit être déposé (documents validés) avant de planifier cette réunion.", 400);
  }

  const date = payload.date ? new Date(payload.date) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Date/heure de réunion invalide.", 400);
  const type = payload.type === "IN_PERSON" ? "IN_PERSON" : "ONLINE";
  const location = String(payload.location || "").trim();
  if (!location) throw fail(type === "ONLINE" ? "Le lien de la réunion (Meet) est obligatoire." : "L'adresse de la réunion est obligatoire.", 400);
  const instructions = payload.instructions ? String(payload.instructions).trim() : null;

  const wasScheduled = Boolean(application.visa_prep_meeting_at);
  const updated = await appRepo.update(applicationId, {
    visa_prep_meeting_at: date,
    visa_prep_meeting_type: type,
    visa_prep_meeting_location: location,
    visa_prep_meeting_instructions: instructions
  });

  await recordHistory(
    applicationId,
    application.student_id,
    application.visa_status,
    application.visa_status,
    auth.sub,
    `Réunion de préparation à l'entretien visa ${wasScheduled ? "reprogrammée" : "planifiée"} le ${date.toLocaleString("fr-FR")}.`
  );
  await notifyStudent(
    updated,
    `Une réunion de préparation à votre entretien visa a été ${wasScheduled ? "reprogrammée" : "planifiée"} le ${date.toLocaleString("fr-FR")}.`,
    auth.sub
  );

  try {
    const student = await userRepo.findById(application.student_id);
    if (student?.email) {
      await emailService.sendVisaPrepMeetingEmail(student.email, student.prenom, {
        dateLabel: date.toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        type,
        location,
        instructions
      });
    }
  } catch (err) {
    logger.error("Échec de l'envoi de l'email de réunion de préparation visa", { message: err.message, stack: err.stack });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// §Visa — le RDV enregistre la date du rendez-vous obtenu auprès de
// l'ambassade/du consulat pour l'entretien visa. Peut être reprogrammée.
async function scheduleVisaEmbassyAppointment(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertRdvOrAdmin(auth, application);
  if (!application.visa_status || application.visa_status === "PREPARATION") {
    throw fail("Le dossier visa doit être déposé (documents validés) avant d’enregistrer ce rendez-vous.", 400);
  }

  const date = payload.date ? new Date(payload.date) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Date/heure de rendez-vous invalide.", 400);

  const wasScheduled = Boolean(application.visa_embassy_appointment_at);
  const updated = await appRepo.update(applicationId, { visa_embassy_appointment_at: date });

  await recordHistory(
    applicationId,
    application.student_id,
    application.visa_status,
    application.visa_status,
    auth.sub,
    `Rendez-vous à l'ambassade ${wasScheduled ? "reprogrammé" : "enregistré"} le ${date.toLocaleString("fr-FR")}.`
  );
  await notifyStudent(
    updated,
    `Votre rendez-vous à l'ambassade pour l'entretien visa a été ${wasScheduled ? "reprogrammé" : "enregistré"} le ${date.toLocaleString("fr-FR")}.`,
    auth.sub
  );

  try {
    const student = await userRepo.findById(application.student_id);
    if (student?.email) {
      await emailService.sendVisaEmbassyAppointmentEmail(student.email, student.prenom, {
        dateLabel: date.toLocaleString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
      });
    }
  } catch (err) {
    logger.error("Échec de l'envoi de l'email de rendez-vous ambassade", { message: err.message, stack: err.stack });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// Vue "mes dossiers" pour un RDV : toutes les candidatures qui lui sont
// assignées, tous étudiants confondus.
async function listMineForRdv(auth) {
  const roles = authRoles(auth);
  if (!roles.includes("RDV") && !roles.includes("ADMIN")) {
    throw fail("Action réservée au Responsable Dossier Visa.", 403);
  }
  const rows = await appRepo.listForRdv(auth.sub);
  return rows.map((r) => ({ ...dto(r), studentName: `${r.student_prenom} ${r.student_nom}`.trim(), studentEmail: r.student_email }));
}

module.exports = {
  checkAndAdvanceReadyToApply,
  assignRdv,
  suggestRdv,
  listMineForRdv,
  listForStudent,
  getHistoryForStudent,
  markApplied,
  scheduleInterview,
  completeInterview,
  markAccepted,
  markRejected,
  closeApplication,
  reapply,
  markVisaSubmitted,
  markVisaAccepted,
  markVisaRejected,
  scheduleVisaPrepMeeting,
  scheduleVisaEmbassyAppointment
};
