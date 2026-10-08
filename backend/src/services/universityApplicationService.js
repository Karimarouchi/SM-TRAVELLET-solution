const appRepo = require("../repositories/universityApplicationRepository");
const countryRepo = require("../repositories/countryRepository");
const universityRepo = require("../repositories/countryUniversityRepository");
const countryUniversityService = require("./countryUniversityService");
const choiceRepo = require("../repositories/universityChoiceRepository");
const choiceService = require("./universityChoiceService");
const paymentService = require("./paymentService");
const studentDocRepo = require("../repositories/studentDocumentRepository");
const studentRepo = require("../repositories/studentRepository");
const userRepo = require("../repositories/userRepository");
const userRoleRepo = require("../repositories/userRoleRepository");
const notificationService = require("./notificationService");
const emailService = require("./emailService");
const googleCalendar = require("./googleCalendarService");
const commissionService = require("./commissionService");
const logger = require("../logger");
const { canAccessStudent, canAccessApplication, authRoles } = require("../security/rbac");

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Colonne DATE : pg la renvoie à minuit local, on garde le jour sans décalage de fuseau.
function dateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
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
    choiceId: row.choice_id || null,
    fieldOfStudy: row.field_of_study || "",
    programmeId: row.programme_id,
    programmeTitle: row.programme_title || null,
    salesId: row.sales_id,
    assignedRdvId: row.assigned_rdv_id,
    assignedRdvName: row.rdv_prenom || row.rdv_nom ? `${row.rdv_prenom || ""} ${row.rdv_nom || ""}`.trim() : null,
    assignedRdvEmail: row.rdv_email || null,
    assignedRdvPhone: row.rdv_phone || null,
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
    staffMeetAt: row.staff_meet_at,
    staffMeetLink: row.staff_meet_link,
    staffMeetInstructions: row.staff_meet_instructions,
    visaDocsValidatedAt: row.visa_docs_validated_at,
    postponedKind: row.postponed_kind || null,
    postponedAt: row.postponed_at || null,
    retryOn: dateOnly(row.retry_on),
    retryIntake: row.retry_intake || "",
    postponedNote: row.postponed_note || "",
    retryOfId: row.retry_of_id || null,
    attemptNumber: row.attempt_number || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function recordHistory(applicationId, studentId, oldStatus, newStatus, changedBy, comment) {
  await appRepo.addHistory({ applicationId, studentId, oldStatus, newStatus, changedBy, comment });
}

// Appelée après chaque validation de document (studentDocumentService) et
// après l'ajout d'un vœu. Une candidature READY_TO_APPLY naît d'un vœu quand
// TOUS les documents obligatoires du pays (communs, déposés une seule fois)
// ET ceux propres à l'université sont VALIDATED ; le dossier global passe alors
// en phase UNIVERSITY_APPLICATION. N'écrase jamais une candidature existante.
async function checkAndAdvanceReadyToApply(studentId) {
  const profile = await studentRepo.findByUserId(studentId);
  if (!profile) return;
  const preferredCountries = profile.preferred_countries || [];
  if (!preferredCountries.length) return;

  await choiceService.ensureInitialChoice(studentId);
  const choices = await choiceRepo.listActiveForStudent(studentId);

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

    // Un vœu sans candidature devient « prêt à postuler » quand les documents
    // propres à son université sont aussi validés.
    for (const choice of choices.filter((c) => c.country_id === country.id && !c.application_id)) {
      const specific = await studentDocRepo.findRequiredActiveStatusesForUniversity(choice.university_id, studentId);
      if (!specific.every((s) => s.status === "VALIDATED")) continue;

      const created = await appRepo.create({
        studentId,
        countryId: country.id,
        universityId: choice.university_id,
        salesId: profile.assigned_sales_id,
        choiceId: choice.id,
        fieldOfStudy: choice.field_of_study
      });
      await recordHistory(created.id, studentId, null, "READY_TO_APPLY", null, `Documents validés — dossier prêt à postuler (${choice.university_name}${choice.field_of_study ? `, ${choice.field_of_study}` : ""}).`);
      await autoAssignRdvForApply(created);
    }
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
function assertRdvOrAdmin(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  if (roles.includes("RDV") && application.assigned_rdv_id === auth.sub) return;
  throw fail("Action réservée au Responsable Dossier Visa assigné ou à l’administrateur.", 403);
}

function assertUniversityActor(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  if (roles.includes("RDV") && application.assigned_rdv_id === auth.sub) return;
  throw fail("Le dépôt et le suivi universitaire sont gérés par le RDV assigné.", 403);
}

function assertSalesAdminOrOwnerStudent(auth, application) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN") || roles.includes("SALES")) return;
  if (roles.includes("RDV") && application.assigned_rdv_id === auth.sub) return;
  if (auth.role === "STUDENT" && auth.sub === application.student_id) return;
  throw fail("Action non autorisée.", 403);
}

async function isActiveRdv(userId) {
  if (!userId) return false;
  const user = await userRepo.findById(userId);
  if (!user || user.is_active === false) return false;
  const roles = await userRoleRepo.getEffectiveRoles(user);
  return roles.includes("RDV");
}

async function pickRdv({ countryId, preferredUserId }) {
  if (preferredUserId && (await isActiveRdv(preferredUserId))) {
    const user = await userRepo.findById(preferredUserId);
    return { rdvUserId: preferredUserId, rdvName: `${user.prenom} ${user.nom}`.trim(), fallback: false, sameAsPart1: true };
  }
  const suggestion = await computeRdvSuggestion(countryId);
  return { ...suggestion, sameAsPart1: false };
}

async function applyRdvAssignment(application, pick, { visaPreparation, actorId, comment }) {
  const fields = { assigned_rdv_id: pick.rdvUserId };
  if (visaPreparation && !application.visa_status) fields.visa_status = "PREPARATION";
  const updated = await appRepo.update(application.id, fields);
  await recordHistory(
    application.id,
    application.student_id,
    application.status,
    application.status,
    actorId || null,
    comment
  );
  if (pick.rdvUserId) {
    await notificationService.notify(pick.rdvUserId, {
      type: "APPLICATION_ASSIGNED",
      title: visaPreparation ? "Dossier visa à déposer" : "Candidature universitaire à déposer",
      body: visaPreparation
        ? "Les documents visa sont validés. Vous pouvez déposer le dossier."
        : "Les documents d'études sont validés. Un Meet avec l'étudiant est optionnel, puis déposez la candidature.",
      link: visaPreparation ? "/rdv/visas" : "/rdv"
    });
  }
  return updated;
}

// Un étudiant a UN SEUL RDV pour toutes ses candidatures, même s'il vise plusieurs pays :
//  1. s'il a déjà un RDV sur une autre candidature en cours, c'est le même ;
//  2. sinon, le RDV spécialisé qui couvre le plus de ses pays visés (les pays de ses
//     vœux en cours et celui de cette candidature), le moins chargé en cas d'égalité ;
//  3. à défaut de spécialiste, le RDV actif le moins chargé.
async function pickRdvForStudent(application) {
  const others = (await appRepo.listForStudent(application.student_id)).filter(
    (a) => a.id !== application.id && a.assigned_rdv_id && !["CLOSED", "REJECTED", "POSTPONED"].includes(a.status)
  );
  for (const other of others) {
    if (await isActiveRdv(other.assigned_rdv_id)) {
      const user = await userRepo.findById(other.assigned_rdv_id);
      return { rdvUserId: other.assigned_rdv_id, rdvName: `${user.prenom} ${user.nom}`.trim(), fallback: false, sameStudent: true, covered: null };
    }
  }

  const choices = await choiceRepo.listActiveForStudent(application.student_id);
  const countryIds = [...new Set([application.country_id, ...choices.map((c) => c.country_id)])];
  const specialists = await userRoleRepo.findRdvByCoverage(countryIds);
  if (specialists.length) {
    const best = specialists[0];
    return { rdvUserId: best.id, rdvName: `${best.prenom} ${best.nom}`.trim(), fallback: false, sameStudent: false, covered: best.covered, wanted: countryIds.length };
  }
  const suggestion = await computeRdvSuggestion(application.country_id);
  return { ...suggestion, sameStudent: false, covered: null };
}

async function autoAssignRdvForApply(application) {
  const pick = await pickRdvForStudent(application);
  if (!pick.rdvUserId) return application;
  const comment = pick.sameStudent
    ? `RDV attribué à ${pick.rdvName} (déjà le RDV de cet étudiant : un seul RDV par étudiant).`
    : pick.fallback
      ? `RDV attribué à ${pick.rdvName} (répartition équitable, aucun spécialiste pour ce pays).`
      : pick.covered && pick.wanted > 1
        ? `RDV attribué à ${pick.rdvName} (spécialiste de ${pick.covered} des ${pick.wanted} pays visés par l'étudiant).`
        : `RDV attribué à ${pick.rdvName} pour le dépôt de candidature.`;
  return applyRdvAssignment(application, pick, { visaPreparation: false, comment });
}

async function autoAssignRdvForVisa(application) {
  const pick = await pickRdv({ countryId: application.country_id, preferredUserId: application.assigned_rdv_id });
  if (!pick.rdvUserId) {
    throw fail("Aucun Responsable Dossier Visa actif n'existe pour reprendre ce dossier.", 409);
  }
  const comment = pick.sameAsPart1
    ? `Documents visa validés — le dossier revient à ${pick.rdvName} (même RDV qu'en partie 1).`
    : `Documents visa validés — ${pick.rdvName} reprend le dossier (RDV de la partie 1 inactif, moins chargé).`;
  const updated = await applyRdvAssignment(application, pick, { visaPreparation: true, comment });
  if (!application.visa_docs_validated_at) {
    await appRepo.update(application.id, { visa_docs_validated_at: new Date() });
  }
  if (application.sales_id) {
    await commissionService.awardCommission({
      userId: application.sales_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "SALES",
      stage: "VISA_DOCUMENTS_VALIDATED",
      applicationId: application.id
    });
  }
  return updated;
}

async function maybeAdvanceVisaAfterDocs(applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application || application.status !== "ACCEPTED") return;
  if (application.visa_status) return;
  const requiredStatuses = await studentDocRepo.findRequiredActiveVisaStatusesForCountry(application.country_id, application.student_id);
  // Aucun document visa requis : le dossier ne part pas tout seul chez le RDV, le
  // conseiller le confirme (confirmVisaDocs) pour qu'il reste maître de la transmission.
  if (!requiredStatuses.length) return;
  if (requiredStatuses.every((r) => r.status === "VALIDATED") && !application.visa_docs_validated_at) {
    await autoAssignRdvForVisa(application);
  }
}

// §5 — Marquer comme candidature déposée. Confirme (ou modifie) l'université
// choisie par l'étudiant, renseigne la date/référence/commentaire.
function requireHttpsUrl(raw, label) {
  let parsed;
  try {
    parsed = new URL(String(raw || "").trim());
  } catch {
    throw fail(`${label} invalide.`, 400);
  }
  if (parsed.protocol !== "https:") throw fail(`${label} doit commencer par https://.`, 400);
  return parsed.toString();
}

function sanitizeUniversityName(raw) {
  return countryUniversityService.sanitizeName(raw);
}

async function resolveUniversity(countryId, payload) {
  const customName = payload.universityName ? sanitizeUniversityName(payload.universityName) : "";
  if (customName) {
    return universityRepo.findOrCreate({ countryId, name: customName, active: true });
  }
  if (payload.universityId) {
    const university = await universityRepo.findById(payload.universityId);
    if (!university || university.country_id !== countryId) {
      throw fail("Université invalide pour ce pays.", 400);
    }
    return university;
  }
  return null;
}

async function markApplied(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
  await assertApplicationAccess(auth, application);
  if (application.status !== "READY_TO_APPLY") {
    throw fail("Cette candidature n’est pas au statut « prête à postuler ».", 400);
  }

  // Paiement : la tranche inscription doit être réglée avant le dépôt de la candidature.
  await paymentService.assertRegistrationPaid(application);

  let universityId = application.university_id;
  const resolved = await resolveUniversity(application.country_id, payload);
  if (resolved) universityId = resolved.id;

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

  if (application.assigned_rdv_id) {
    await commissionService.awardCommission({
      userId: application.assigned_rdv_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "RDV",
      stage: "APPLIED",
      applicationId
    });
  }

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// Décision de l'université pour UNE filière : l'étudiant (notification + e-mail),
// son conseiller et les admins sont prévenus dès que le RDV l'enregistre.
async function announceDecision(application, { accepted, reason }) {
  const [student, university, country, profile] = await Promise.all([
    userRepo.findById(application.student_id),
    universityRepo.findById(application.university_id),
    countryRepo.findById(application.country_id),
    studentRepo.findByUserId(application.student_id)
  ]);
  const who = student ? `${student.prenom} ${student.nom}` : "Un étudiant";
  const universityName = university?.name || "l'université";
  const fieldOfStudy = application.field_of_study || "";
  const target = fieldOfStudy ? `${universityName} (${fieldOfStudy})` : universityName;
  const verdict = accepted ? "accepté" : "refusé";

  await notificationService.notify(application.student_id, {
    type: accepted ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED",
    title: accepted ? `Candidature acceptée : ${target}` : `Candidature refusée : ${target}`,
    body: accepted
      ? "Félicitations ! Préparez maintenant vos documents visa avec votre conseiller."
      : `${reason ? `Motif : ${reason}. ` : ""}Votre conseiller peut vous proposer une autre université.`,
    link: "/espace"
  });

  const staffPayload = {
    type: accepted ? "APPLICATION_ACCEPTED" : "APPLICATION_REJECTED",
    title: `${who} ${verdict} : ${target}`,
    body: accepted
      ? `L'université a accepté l'étudiant${country?.name ? ` (${country.name})` : ""}. Validez les documents visa, puis le dossier reviendra au RDV.`
      : `L'université a refusé la candidature${country?.name ? ` (${country.name})` : ""}.${reason ? ` Motif : ${reason}.` : ""}`
  };
  const salesId = application.sales_id || profile?.assigned_sales_id || null;
  if (accepted) {
    const visaDocs = await studentDocRepo.findRequiredActiveVisaStatusesForCountry(application.country_id, application.student_id);
    const salesPayload = {
      type: "APPLICATION_ACCEPTED",
      title: `${who} est accepté(e) : ${target}`,
      body: visaDocs.length
        ? "À vous : demandez les documents visa à l'étudiant et validez-les. Le dossier passe ensuite au RDV pour le dépôt du visa."
        : `Aucun document visa n'est demandé${country?.name ? ` pour ${country.name}` : ""} : confirmez dans la fiche pour transmettre le dossier au RDV.`
    };
    if (salesId) await notificationService.notify(salesId, { ...salesPayload, link: `/conseiller/etudiants/${application.student_id}` });
    if (application.assigned_rdv_id) {
      await notificationService.notify(application.assigned_rdv_id, {
        type: "APPLICATION_ACCEPTED",
        title: `${who} est accepté(e) : ${target}`,
        body: "Le conseiller valide d'abord les documents visa. Vous serez prévenu dès que le dossier visa vous revient pour le dépôt.",
        link: "/rdv/visas"
      });
    }
    await notificationService.notifyAdmins({ ...staffPayload, link: `/admin/students/${application.student_id}` });
  } else {
    if (salesId) await notificationService.notify(salesId, { ...staffPayload, link: `/conseiller/etudiants/${application.student_id}` });
    await notificationService.notifyAdmins({ ...staffPayload, link: `/admin/students/${application.student_id}` });
  }

  try {
    if (student?.email) {
      await emailService.sendApplicationDecisionEmail(student.email, student.prenom, {
        accepted,
        universityName,
        fieldOfStudy,
        countryName: country?.name || "",
        reason
      });
    }
  } catch (err) {
    logger.error("Échec de l'envoi de l'email de décision", { message: err.message, stack: err.stack });
  }
}

// Notification à l'étudiant : la première phrase du texte sert de titre,
// la suite de détail.
async function notifyStudent(application, text) {
  const match = String(text).match(/^(.+?[.!?])\s+(.*)$/s);
  await notificationService.notify(application.student_id, {
    type: "APPLICATION_UPDATE",
    title: match ? match[1] : text,
    body: match ? match[2] : "",
    link: "/espace"
  });
}

async function notifyAdminsOfVisaDecision(application, accepted, reason) {
  const student = await userRepo.findById(application.student_id);
  const country = await countryRepo.findById(application.country_id);
  const who = student ? `${student.prenom} ${student.nom}` : "Un étudiant";
  const visa = country?.name ? `Visa ${country.name}` : "Visa";
  await notificationService.notifyAdmins({
    type: accepted ? "VISA_ACCEPTED" : "VISA_REJECTED",
    title: accepted ? `Visa obtenu : ${who}` : `Visa refusé : ${who}`,
    body: accepted ? `${visa} accepté, dossier complet.` : `${visa} refusé. Motif : ${reason}`,
    link: `/conseiller/etudiants/${application.student_id}`
  });
}

// §7 — Entretien demandé / planifié / modifié.
async function scheduleInterview(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
  await assertApplicationAccess(auth, application);
  if (!["WAITING_UNIVERSITY_RESPONSE", "INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED"].includes(application.status)) {
    throw fail("Cette candidature n’est pas dans un état permettant de planifier un entretien.", 400);
  }

  const date = payload.interviewDate ? new Date(payload.interviewDate) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Date/heure d’entretien invalide.", 400);
  // Tous les entretiens se font en ligne.
  const type = "ONLINE";
  if (!payload.interviewLink) throw fail("Le lien de l’entretien en ligne est obligatoire.", 400);
  requireHttpsUrl(payload.interviewLink, "Le lien de l’entretien");

  const wasScheduled = application.status === "INTERVIEW_SCHEDULED";
  const updated = await appRepo.update(applicationId, {
    status: "INTERVIEW_SCHEDULED",
    interview_date: date,
    interview_type: type,
    interview_link: requireHttpsUrl(payload.interviewLink, "Le lien de l’entretien"),
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
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
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
  await announceDecision(application, { accepted: true });

  await studentRepo.setDossierStage(application.student_id, "VISA");

  if (application.assigned_rdv_id) {
    await commissionService.awardCommission({
      userId: application.assigned_rdv_id,
      studentId: application.student_id,
      countryId: application.country_id,
      role: "RDV",
      stage: "ACCEPTED",
      applicationId
    });
  }

  await maybeAdvanceVisaAfterDocs(applicationId);

  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §11 — Refus, motif obligatoire.
async function markRejected(auth, applicationId, reason) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
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
  await announceDecision(application, { accepted: false, reason: trimmed });
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
}

// §12 — Clôturer le parcours (après refus), ne réouvre rien.
async function closeApplication(auth, applicationId, comment) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
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
  const previous = await appRepo.findById(applicationId);
  if (!previous) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, previous);
  await assertApplicationAccess(auth, previous);
  const visaRejected = previous.visa_status === "REJECTED";
  const postponedApplication = previous.status === "POSTPONED" && previous.postponed_kind === "APPLICATION";
  if (previous.status !== "REJECTED" && !visaRejected && !postponedApplication) {
    throw fail("Une nouvelle candidature ne peut être créée qu’après un refus.", 400);
  }
  const university = await resolveUniversity(previous.country_id, payload);
  if (!university) throw fail("Choisissez ou saisissez une université.", 400);

  // L'ancien vœu (refusé) est clos ; la nouvelle université devient un nouveau vœu.
  const fieldOfStudy = String(payload.fieldOfStudy || previous.field_of_study || "").trim();
  if (previous.choice_id) await choiceRepo.withdraw(previous.choice_id);
  let choice = null;
  try {
    choice = await choiceRepo.create({
      studentId: previous.student_id,
      countryId: previous.country_id,
      universityId: university.id,
      fieldOfStudy,
      addedBy: auth.sub,
      addedByRole: authRoles(auth).includes("ADMIN") ? "ADMIN" : "RDV"
    });
  } catch (error) {
    if (error.code !== "23505") throw error;
  }
  const created = await appRepo.create({
    studentId: previous.student_id,
    countryId: previous.country_id,
    universityId: university.id,
    programmeId: payload.programmeId || null,
    salesId: previous.sales_id,
    choiceId: choice ? choice.id : null,
    fieldOfStudy
  });
  await recordHistory(
    created.id,
    previous.student_id,
    null,
    "READY_TO_APPLY",
    auth.sub,
    visaRejected ? `Nouvelle candidature après refus du visa (${university.name}).` : `Nouvelle candidature après refus (${university.name}).`
  );
  await autoAssignRdvForApply(created);
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
  const roles = authRoles(auth);
  if (!roles.includes("ADMIN")) {
    throw fail("La réattribution manuelle d'un RDV est réservée à l'administrateur.", 403);
  }
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);

  let rdvUserId = payload.rdvUserId || null;
  let fallback = false;
  if (!rdvUserId) {
    const suggestion = await computeRdvSuggestion(application.country_id);
    if (!suggestion.rdvUserId) {
      throw fail("Aucun Responsable Dossier Visa actif n'existe. Créez-en un ou choisissez-en un manuellement.", 409);
    }
    rdvUserId = suggestion.rdvUserId;
    fallback = suggestion.fallback;
  } else if (!(await isActiveRdv(rdvUserId))) {
    throw fail("Ce compte n'est pas un Responsable Dossier Visa actif.", 400);
  }

  const wasAlreadyAssigned = Boolean(application.assigned_rdv_id);
  const fields = { assigned_rdv_id: rdvUserId };
  if (application.status === "ACCEPTED" && application.visa_docs_validated_at && !application.visa_status) {
    fields.visa_status = "PREPARATION";
  }
  const updated = await appRepo.update(applicationId, fields);
  const rdvUser = await userRepo.findById(rdvUserId);
  const rdvName = rdvUser ? `${rdvUser.prenom} ${rdvUser.nom}`.trim() : "Responsable Dossier Visa";
  const comment = wasAlreadyAssigned
    ? `Dossier réattribué à ${rdvName}.`
    : fallback
      ? `Dossier transféré à ${rdvName} — attribution équitable parmi tous les RDV actifs.`
      : `Dossier transféré à ${rdvName}.`;
  await recordHistory(applicationId, application.student_id, application.status, application.status, auth.sub, comment);
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

async function scheduleStaffMeet(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
  if (application.status !== "READY_TO_APPLY") {
    throw fail("Le Meet optionnel se planifie avant le dépôt de candidature.", 400);
  }
  const date = payload.date ? new Date(payload.date) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Date/heure du Meet invalide.", 400);
  const link = requireHttpsUrl(payload.link, "Le lien du Meet");
  const instructions = payload.instructions ? String(payload.instructions).trim() : null;
  const updated = await appRepo.update(applicationId, {
    staff_meet_at: date,
    staff_meet_link: link,
    staff_meet_instructions: instructions
  });
  await recordHistory(
    applicationId,
    application.student_id,
    application.status,
    application.status,
    auth.sub,
    `Meet optionnel ${application.staff_meet_at ? "reprogrammé" : "planifié"} le ${date.toLocaleString("fr-FR")}.`
  );
  await notifyStudent(
    updated,
    `Un rendez-vous Meet a été ${application.staff_meet_at ? "reprogrammé" : "planifié"} le ${date.toLocaleString("fr-FR")}. Il n'est pas obligatoire pour déposer la candidature.`,
    auth.sub
  );
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// Crée automatiquement un lien Google Meet (événement Google Calendar) pour
// l'un des trois rendez-vous en ligne. Mêmes droits et mêmes états que la
// planification correspondante : on ne crée pas un événement (et une
// invitation envoyée à l'étudiant) pour une action qui serait refusée ensuite.
const MEET_KINDS = {
  interview: { title: "Entretien universitaire", guard: assertUniversityActor },
  staff: { title: "Rendez-vous SM Travel", guard: assertUniversityActor },
  visaPrep: { title: "Préparation à l'entretien visa", guard: assertRdvOrAdmin }
};
const recentMeetRequests = new Map();

async function createMeetLink(auth, applicationId, payload) {
  const kind = MEET_KINDS[payload?.kind];
  if (!kind) throw fail("Type de rendez-vous inconnu.", 400);
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  kind.guard(auth, application);

  if (payload.kind === "interview" && !["WAITING_UNIVERSITY_RESPONSE", "INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED"].includes(application.status)) {
    throw fail("Cette candidature n’est pas dans un état permettant de planifier un entretien.", 400);
  }
  if (payload.kind === "staff" && application.status !== "READY_TO_APPLY") {
    throw fail("Le Meet optionnel se planifie avant le dépôt de candidature.", 400);
  }
  if (payload.kind === "visaPrep" && (!application.visa_status || application.visa_status === "PREPARATION")) {
    throw fail("Le dossier visa doit être déposé avant de planifier cette réunion.", 400);
  }

  const date = payload.date ? new Date(payload.date) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Choisissez d'abord la date et l'heure du rendez-vous.", 400);

  // Anti double-clic : chaque création envoie une invitation à l'étudiant.
  const key = `${applicationId}:${payload.kind}`;
  if (Date.now() - (recentMeetRequests.get(key) || 0) < 15_000) {
    throw fail("Un lien vient d'être créé pour ce rendez-vous. Patientez quelques secondes.", 429);
  }
  recentMeetRequests.set(key, Date.now());

  const student = await userRepo.findById(application.student_id);
  const actor = await userRepo.findById(auth.sub);
  const university = application.university_id ? await universityRepo.findById(application.university_id) : null;
  const studentName = student ? `${student.prenom} ${student.nom}`.trim() : "étudiant";
  const title = `${kind.title} — ${studentName}${university?.name ? ` (${university.name})` : ""}`;

  try {
    const meet = await googleCalendar.createMeetEvent({
      title,
      description: `Rendez-vous organisé via SM Travel pour ${studentName}.`,
      startAt: date,
      durationMinutes: payload.durationMinutes,
      attendees: [student?.email, actor?.email]
    });
    await recordHistory(
      applicationId,
      application.student_id,
      application.status,
      application.status,
      auth.sub,
      `Lien Google Meet créé automatiquement (${kind.title.toLowerCase()}).`
    );
    return { link: meet.link, calendarLink: meet.htmlLink };
  } catch (error) {
    // L'échec ne doit pas bloquer 15 s de plus la nouvelle tentative.
    recentMeetRequests.delete(key);
    throw error;
  }
}

// Étape visa 1/3 — le dossier visa est déposé.
async function markVisaSubmitted(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertRdvOrAdmin(auth, application);
  if (application.visa_status !== "PREPARATION") {
    throw fail("Le dossier visa n’est pas en préparation.", 400);
  }

  if (!application.visa_docs_validated_at) {
    throw fail("Le conseiller doit d'abord valider les documents visa de l'étudiant.", 400);
  }
  const requiredStatuses = await studentDocRepo.findRequiredActiveVisaStatusesForCountry(application.country_id, application.student_id);
  const notValidated = requiredStatuses.filter((r) => r.status !== "VALIDATED");
  if (notValidated.length) {
    throw fail("Tous les documents visa obligatoires doivent être validés avant de déposer le dossier.", 400);
  }
  // Paiement : la tranche visa doit être réglée avant le dépôt.
  await paymentService.assertVisaPaid(application);

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
  await notifyAdminsOfVisaDecision(application, true);
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

// Le conseiller confirme que les documents visa sont validés — y compris quand le pays
// n'en demande aucun — et transmet le dossier au RDV.
async function confirmVisaDocs(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertSalesAdminOrOwnerStudent(auth, application);
  if (auth.role === "STUDENT" || auth.role === "RDV") throw fail("Action réservée au conseiller.", 403);
  await assertApplicationAccess(auth, application);
  if (application.status !== "ACCEPTED" || application.visa_status) {
    throw fail("Ce dossier n'attend pas la validation des documents visa.", 400);
  }
  const requiredStatuses = await studentDocRepo.findRequiredActiveVisaStatusesForCountry(application.country_id, application.student_id);
  if (requiredStatuses.some((r) => r.status !== "VALIDATED")) {
    throw fail("Validez d'abord tous les documents visa obligatoires.", 400);
  }
  const updated = await autoAssignRdvForVisa(application);
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name });
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
  await notifyAdminsOfVisaDecision(application, false, trimmed);
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
  return Promise.all(
    rows.map(async (r) => ({
      ...dto(r),
      studentName: `${r.student_prenom} ${r.student_nom}`.trim(),
      studentEmail: r.student_email,
      // Tranche visa non réglée : le dépôt du visa sera refusé tant qu'elle reste due.
      visaPaymentDue: r.visa_status === "PREPARATION" ? await paymentService.visaPaymentDue(r.student_id, r.country_id) : null,
      // Tranche inscription non réglée : le dépôt de la candidature sera refusé tant qu'elle reste due.
      registrationPaymentDue: r.status === "READY_TO_APPLY" ? await paymentService.registrationPaymentDue(r.student_id, r.country_id) : null
    }))
  );
}

// Refus à retenter plus tard (nouvelle session de la fac, nouveau dépôt de visa).
// Le dossier quitte le pipeline actif jusqu'à la date de relance : plus aucun
// retard, tâche ni KPI n'est calculé dessus. La tentative suivante reste liée.
async function postpone(auth, applicationId, payload) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
  await assertApplicationAccess(auth, application);

  const visaRefused = application.visa_status === "REJECTED";
  const kind = visaRefused ? "VISA" : "APPLICATION";
  const refused = application.status === "REJECTED" || (visaRefused && ["ACCEPTED", "CLOSED"].includes(application.status));
  if (!refused) throw fail("Seul un dossier refusé peut être reporté.", 400);

  const retryOn = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.retryOn || "")) ? String(payload.retryOn) : "";
  if (!retryOn || Number.isNaN(new Date(retryOn).getTime())) throw fail("La date de la nouvelle tentative est obligatoire.", 400);
  if (retryOn < new Date().toISOString().slice(0, 10)) throw fail("La date de la nouvelle tentative doit être dans le futur.", 400);
  const intake = String(payload.intake || "").trim().slice(0, 120);
  const note = String(payload.note || "").trim().slice(0, 1000);

  const updated = await appRepo.update(applicationId, {
    status: "POSTPONED",
    postponed_kind: kind,
    postponed_at: new Date(),
    retry_on: retryOn,
    retry_intake: intake || null,
    postponed_note: note || null,
    retry_reminder_sent_at: null
  });
  // Le vœu est libéré : l'étudiant n'a plus de candidature « en cours » ici.
  if (kind === "APPLICATION" && application.choice_id) await choiceRepo.withdraw(application.choice_id);
  await recordHistory(
    applicationId,
    application.student_id,
    application.status,
    "POSTPONED",
    auth.sub,
    `${kind === "VISA" ? "Visa" : "Candidature"} reporté(e) : nouvelle tentative le ${retryOn}${intake ? ` (${intake})` : ""}.${note ? ` ${note}` : ""}`
  );
  await notifyStudent(
    application,
    `${kind === "VISA" ? "Votre visa sera redéposé" : "Votre candidature sera retentée"} le ${retryOn}.${intake ? ` Rentrée visée : ${intake}.` : ""} Votre conseiller vous recontactera.`
  );
  return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
}

// Relance d'un dossier reporté. Candidature : une NOUVELLE candidature (même
// université et filière) liée à l'ancienne. Visa : le dossier visa repart en
// préparation. Les commissions (une par étape et par pays) ne sont pas versées deux fois.
async function retryPostponed(auth, applicationId) {
  const application = await appRepo.findById(applicationId);
  if (!application) throw fail("Candidature introuvable.", 404);
  assertUniversityActor(auth, application);
  await assertApplicationAccess(auth, application);
  if (application.status !== "POSTPONED") throw fail("Ce dossier n'est pas reporté.", 400);

  if (application.postponed_kind === "VISA") {
    const updated = await appRepo.update(applicationId, {
      status: "ACCEPTED",
      visa_status: "PREPARATION",
      visa_decision_at: null,
      visa_decision_reason: null,
      visa_submitted_at: null,
      postponed_kind: null,
      retry_on: null,
      attempt_number: (application.attempt_number || 1) + 1
    });
    await recordHistory(applicationId, application.student_id, "POSTPONED", "VISA_PREPARATION", auth.sub, `Nouvelle tentative visa (n°${updated.attempt_number}).`);
    return dto({ ...updated, country_name: (await countryRepo.findById(updated.country_id))?.name, university_name: (await universityRepo.findById(updated.university_id))?.name });
  }

  const created = await reapply(auth, applicationId, { universityId: application.university_id, fieldOfStudy: application.field_of_study });
  await appRepo.update(created.id, { retry_of_id: applicationId, attempt_number: (application.attempt_number || 1) + 1 });
  await appRepo.update(applicationId, { status: "CLOSED" });
  await recordHistory(applicationId, application.student_id, "POSTPONED", "CLOSED", auth.sub, "Remplacée par une nouvelle tentative.");
  return { ...created, retryOfId: applicationId, attemptNumber: (application.attempt_number || 1) + 1 };
}

// Rappel au RDV (et au conseiller) quand la date de relance approche : une seule fois.
async function sendRetryReminders() {
  const rows = await appRepo.listRetryDue(7);
  for (const row of rows) {
    const who = `${row.student_prenom} ${row.student_nom}`;
    const what = row.postponed_kind === "VISA" ? "Redéposer le visa" : "Retenter la candidature";
    const payload = {
      type: "APPLICATION_UPDATE",
      title: `${what} : ${who}`,
      body: `${row.university_name} (${row.country_name}) : nouvelle tentative prévue le ${dateOnly(row.retry_on)}.`
    };
    const link = row.postponed_kind === "VISA" ? "/rdv/visas" : "/rdv";
    if (row.assigned_rdv_id) await notificationService.notify(row.assigned_rdv_id, { ...payload, link });
    if (row.sales_id) await notificationService.notify(row.sales_id, { ...payload, link: `/conseiller/etudiants/${row.student_id}` });
    await appRepo.update(row.id, { retry_reminder_sent_at: new Date() });
  }
}

module.exports = {
  confirmVisaDocs,
  postpone,
  retryPostponed,
  sendRetryReminders,
  checkAndAdvanceReadyToApply,
  maybeAdvanceVisaAfterDocs,
  assignRdv,
  suggestRdv,
  scheduleStaffMeet,
  createMeetLink,
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
