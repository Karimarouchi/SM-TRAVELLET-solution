const { transaction } = require("../../db");
const choiceRepo = require("../repositories/universityChoiceRepository");
const universityRepo = require("../repositories/countryUniversityRepository");
const documentRepo = require("../repositories/documentRequirementRepository");
const countryRepo = require("../repositories/countryRepository");
const studentRepo = require("../repositories/studentRepository");
const appRepo = require("../repositories/universityApplicationRepository");
const userRepo = require("../repositories/userRepository");
const countryUniversityService = require("./countryUniversityService");
const notificationService = require("./notificationService");
const { canAccessStudent, authRoles } = require("../security/rbac");
const { canViewStudent } = require("../security/studentView");
const logger = require("../logger");

// Nombre maximum de candidatures actives en même temps (une université avec
// deux filières compte pour deux). Un refus ou une clôture libère une place.
const MAX_ACTIVE_CHOICES = 3;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dto(row, specificDocsCount = 0) {
  return {
    id: row.id,
    studentId: row.student_id,
    countryId: row.country_id,
    countryName: row.country_name,
    universityId: row.university_id,
    universityName: row.university_name,
    partner: row.university_source === "ADMIN",
    fieldOfStudy: row.field_of_study || "",
    addedByRole: row.added_by_role,
    applicationId: row.application_id || null,
    applicationStatus: row.application_status || null,
    specificDocsCount,
    createdAt: row.created_at
  };
}

async function withDocCounts(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!counts.has(row.university_id)) {
      const docs = await documentRepo.findByUniversity(row.university_id);
      counts.set(row.university_id, docs.filter((d) => d.active).length);
    }
  }
  return rows.map((row) => dto(row, counts.get(row.university_id)));
}

async function summary(studentId) {
  const rows = await choiceRepo.listActiveForStudent(studentId);
  return { limit: MAX_ACTIVE_CHOICES, used: rows.length, choices: await withDocCounts(rows) };
}

async function assertStudentAccess(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return profile;
}

async function listMine(studentId) {
  return summary(studentId);
}

async function listForStudent(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!(await canViewStudent(auth, studentId, profile.assigned_sales_id))) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return summary(studentId);
}

async function pickerForCountry(countryId) {
  const country = await countryRepo.findById(countryId);
  if (!country || !country.active) throw fail("Pays introuvable.", 404);
  const rows = await universityRepo.findPickerByCountry(countryId);
  return rows.map((row) => ({ id: row.id, countryId: row.country_id, name: row.name, partner: row.source === "ADMIN" }));
}

function normalizeField(raw) {
  const field = String(raw || "").trim().replace(/\s+/g, " ");
  if (!field) throw fail("Précisez la filière visée.", 400);
  if (field.length > 120) throw fail("La filière est trop longue (120 caractères maximum).", 400);
  return field;
}

// Université choisie dans la liste, ou saisie librement. Une saisie libre est
// enregistrée dans la liste du pays (hors conventions) : le prochain étudiant
// qui la choisit retrouve les documents déjà définis par le conseiller.
async function resolveUniversity(countryId, payload) {
  const name = payload.universityName ? countryUniversityService.sanitizeName(payload.universityName) : "";
  if (payload.universityId) {
    const university = await universityRepo.findById(payload.universityId);
    if (!university || university.country_id !== countryId) throw fail("Université invalide pour ce pays.", 400);
    return university;
  }
  if (!name) throw fail("Choisissez ou saisissez une université.", 400);
  return universityRepo.findOrCreate({ countryId, name, active: false, source: "STUDENT" });
}

async function notifyAdvisorOfNewChoice({ studentId, profile, university, country, fieldOfStudy, createdUniversity, actor }) {
  const student = await userRepo.findById(studentId);
  const who = student ? `${student.prenom} ${student.nom}` : "Un étudiant";
  const target = `${university.name}${fieldOfStudy ? ` (${fieldOfStudy})` : ""}`;
  const missingDocs = createdUniversity || (university.source === "STUDENT" && !(await documentRepo.findByUniversity(university.id)).length);
  const payload = {
    type: "UNIVERSITY_CHOICE_ADDED",
    title: `${who} vise aussi : ${university.name}`,
    body: `Nouvelle candidature ${target} en ${country.name}${actor === "STUDENT" ? " ajoutée par l'étudiant" : ""}.${missingDocs ? " Cette université est hors conventions : définissez ses documents spécifiques." : ""}`,
    link: `/conseiller/etudiants/${studentId}`
  };
  if (profile.assigned_sales_id) await notificationService.notify(profile.assigned_sales_id, payload);
  else await notificationService.notifyAdmins({ ...payload, link: `/admin/students/${studentId}` });
}

// Ajout d'un vœu par l'étudiant, son conseiller ou un admin.
async function addChoice(auth, studentId, payload) {
  const roles = authRoles(auth);
  const actorRole = roles.includes("ADMIN") ? "ADMIN" : roles.includes("SALES") ? "SALES" : "STUDENT";
  if (actorRole === "STUDENT" && auth.sub !== studentId) throw fail("Accès refusé.", 403);
  const profile = await assertStudentAccess(auth, studentId);

  const country = await countryRepo.findById(payload.countryId);
  if (!country || !country.active) throw fail("Pays introuvable.", 404);
  const fieldOfStudy = normalizeField(payload.fieldOfStudy);

  const before = payload.universityId ? null : await universityRepo.findByCountryAndName(country.id, String(payload.universityName || ""));
  const university = await resolveUniversity(country.id, payload);
  const createdUniversity = !payload.universityId && !before && university.source === "STUDENT";

  const created = await transaction(async (db) => {
    await choiceRepo.lockStudent(db, studentId);
    const active = await choiceRepo.countActive(studentId, db);
    if (active >= MAX_ACTIVE_CHOICES) {
      throw fail(`Vous pouvez postuler à ${MAX_ACTIVE_CHOICES} universités maximum en même temps. Une place se libère quand une candidature est refusée ou retirée.`, 409);
    }
    try {
      return await choiceRepo.create({ studentId, countryId: country.id, universityId: university.id, fieldOfStudy, addedBy: auth.sub, addedByRole: actorRole }, db);
    } catch (error) {
      if (error.code === "23505") throw fail("Cette université et cette filière font déjà partie de vos candidatures.", 409);
      throw error;
    }
  });

  await choiceRepo.addPreferredCountry(studentId, country.name);
  await notifyAdvisorOfNewChoice({ studentId, profile, university, country, fieldOfStudy, createdUniversity, actor: actorRole }).catch((err) => {
    logger.error("Échec de la notification d'un nouveau vœu", { message: err.message });
  });

  // Les documents communs peuvent déjà être validés : la candidature naît tout de suite.
  const applicationService = require("./universityApplicationService");
  await applicationService.checkAndAdvanceReadyToApply(studentId).catch((err) => {
    logger.error("Échec du calcul READY_TO_APPLY après ajout d'un vœu", { message: err.message });
  });

  return summary(studentId);
}

// Retire un vœu qui n'a pas encore été déposé auprès de l'université.
async function removeChoice(auth, choiceId) {
  const choice = await choiceRepo.findById(choiceId);
  if (!choice) throw fail("Candidature introuvable.", 404);
  if (authRoles(auth).includes("STUDENT") && auth.sub !== choice.student_id) throw fail("Accès refusé.", 403);
  await assertStudentAccess(auth, choice.student_id);
  if (choice.withdrawn_at) throw fail("Cette candidature est déjà retirée.", 400);
  if (choice.application_status && choice.application_status !== "READY_TO_APPLY") {
    throw fail("Cette candidature a déjà été déposée auprès de l'université : elle ne peut plus être retirée.", 400);
  }
  if (choice.application_id) {
    await appRepo.update(choice.application_id, { status: "CLOSED" });
    await appRepo.addHistory({
      applicationId: choice.application_id,
      studentId: choice.student_id,
      oldStatus: "READY_TO_APPLY",
      newStatus: "CLOSED",
      changedBy: auth.sub,
      comment: "Candidature retirée avant dépôt."
    });
  }
  await choiceRepo.withdraw(choiceId);
  return summary(choice.student_id);
}

// Étudiants créés avant cette fonction (ou dont l'onboarding vient d'être
// rempli) : l'université de la fiche devient le premier vœu. Ne recrée jamais
// un vœu que l'étudiant a retiré.
async function ensureInitialChoice(studentId) {
  const profile = await studentRepo.findByUserId(studentId);
  if (!profile || !profile.target_university || !(profile.preferred_countries || []).length) return null;
  if (await choiceRepo.hasAnyForStudent(studentId)) return null;

  let university = null;
  let country = null;
  for (const countryName of profile.preferred_countries) {
    const candidate = await countryRepo.findByNameCaseInsensitive(countryName);
    if (!candidate || !candidate.active) continue;
    const found = await universityRepo.findByCountryAndName(candidate.id, profile.target_university);
    if (found) {
      university = found;
      country = candidate;
      break;
    }
    if (!country) country = candidate;
  }
  if (!country) return null;
  if (!university) {
    university = await universityRepo.findOrCreate({ countryId: country.id, name: profile.target_university, active: false, source: "STUDENT" });
  }
  try {
    return await choiceRepo.create({
      studentId,
      countryId: country.id,
      universityId: university.id,
      fieldOfStudy: String(profile.target_field || "").trim(),
      addedBy: studentId,
      addedByRole: "SYSTEM"
    });
  } catch (error) {
    if (error.code === "23505") return null;
    throw error;
  }
}

module.exports = {
  MAX_ACTIVE_CHOICES,
  listMine,
  listForStudent,
  pickerForCountry,
  addChoice,
  removeChoice,
  ensureInitialChoice
};
