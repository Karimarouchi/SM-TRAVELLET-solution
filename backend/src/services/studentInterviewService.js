const interviewRepo = require("../repositories/studentInterviewRepository");
const userRoleRepo = require("../repositories/userRoleRepository");
const userRepo = require("../repositories/userRepository");
const studentRepo = require("../repositories/studentRepository");
const notificationService = require("./notificationService");
const { authRoles } = require("../security/rbac");
const logger = require("../logger");

// Entretien d'orientation : déclenché quand les documents du pays sont validés pour un étudiant
// qui n'a encore aucune université. Le RDV (attribué selon le pays) s'entretient avec lui,
// puis choisit 1 à 3 universités et leur filière.

const MAX_PICKS = 3;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function dto(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: `${row.prenom || ""} ${row.nom || ""}`.trim(),
    studentEmail: row.email,
    countryId: row.country_id,
    countryName: row.country_name,
    rdvId: row.rdv_id,
    status: row.status,
    scheduledAt: row.scheduled_at,
    meetLink: row.meet_link,
    completedAt: row.completed_at,
    createdAt: row.created_at
  };
}

async function pickRdv(countryId) {
  const specialists = await userRoleRepo.findRdvByCoverage([countryId]);
  if (specialists.length) return specialists[0];
  const anyRdv = await userRoleRepo.findLeastLoadedActiveRdv();
  return anyRdv[0] || null;
}

// Appelé quand les documents d'un pays sont tous validés et que l'étudiant n'a aucun vœu.
async function requestInterview(studentId, country) {
  const existing = (await interviewRepo.listForStudent(studentId)).find((i) => i.country_id === country.id);
  if (existing && existing.status !== "COMPLETED") {
    // Aucun RDV n'était disponible à la création : on réessaie dès qu'il y en a un.
    if (!existing.rdv_id) {
      const rdv = await pickRdv(country.id);
      if (rdv) {
        await interviewRepo.update(existing.id, { rdv_id: rdv.id });
        await notificationService.notify(rdv.id, {
          type: "INTERVIEW_ASSIGNED",
          title: "Entretien à organiser",
          body: `${existing.prenom} ${existing.nom} : documents ${country.name} validés. Organisez l'entretien puis choisissez avec lui les universités.`,
          link: "/rdv",
          coverItem: studentId,
          coverScope: "RDV"
        }).catch(() => {});
      }
    }
    return existing;
  }
  // Toutes ses candidatures ont été refusées ou retirées : l'entretien est rouvert pour choisir de nouvelles universités.
  if (existing) {
    const rdvId = existing.rdv_id || (await pickRdv(country.id))?.id || null;
    await interviewRepo.update(existing.id, { status: "PENDING", completed_at: null, scheduled_at: null, meet_link: null, rdv_id: rdvId });
    if (rdvId) {
      await notificationService.notify(rdvId, {
        type: "INTERVIEW_ASSIGNED",
        title: "Nouvel entretien à organiser",
        body: `${existing.prenom} ${existing.nom} n'a plus aucune université en cours (${country.name}) : choisissez-en de nouvelles avec lui.`,
        link: "/rdv",
        coverItem: studentId,
        coverScope: "RDV"
      }).catch(() => {});
    }
    return existing;
  }
  const rdv = await pickRdv(country.id);
  const created = await interviewRepo.createIfMissing({ studentId, countryId: country.id, rdvId: rdv?.id });
  if (!created) return null;

  const student = await userRepo.findById(studentId);
  const name = student ? `${student.prenom} ${student.nom}`.trim() : "Un étudiant";
  if (rdv) {
    await notificationService.notify(rdv.id, {
      type: "INTERVIEW_ASSIGNED",
      title: "Entretien à organiser",
      body: `${name} : documents ${country.name} validés. Organisez l'entretien puis choisissez avec lui les universités.`,
      link: "/rdv",
      coverItem: studentId,
      coverScope: "RDV"
    }).catch((err) => logger.error("Notification d'entretien (RDV) échouée", { message: err.message }));
  } else {
    await notificationService.notifyAdmins({
      type: "INTERVIEW_UNASSIGNED",
      title: "Entretien sans Responsable Dossier",
      body: `${name} : documents ${country.name} validés, mais aucun Responsable Dossier n'est disponible.`,
      link: "/admin"
    }).catch(() => {});
  }
  await notificationService.notify(studentId, {
    type: "INTERVIEW_ASSIGNED",
    title: "Vos documents sont validés",
    body: `Un Responsable Dossier va vous contacter pour un entretien afin de choisir ensemble votre université en ${country.name}.`,
    link: "/espace"
  }).catch(() => {});
  return created;
}

async function assertHandler(auth, interview) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return;
  if (roles.includes("RDV") && (await interviewRepo.rdvHasStudent(auth.sub, interview.student_id))) return;
  throw fail("Cet entretien n'est pas le vôtre.", 403);
}

async function listMineForRdv(auth) {
  const rows = authRoles(auth).includes("ADMIN") && !authRoles(auth).includes("RDV")
    ? await interviewRepo.listAllPending()
    : await interviewRepo.listForRdv(auth.sub);
  return rows.map(dto);
}

async function listForStudent(studentId) {
  return (await interviewRepo.listForStudent(studentId)).map(dto);
}

async function schedule(auth, id, payload) {
  const interview = await interviewRepo.findById(id);
  if (!interview) throw fail("Entretien introuvable.", 404);
  await assertHandler(auth, interview);
  if (interview.status === "COMPLETED") throw fail("Cet entretien est déjà terminé.", 400);
  const date = payload.date ? new Date(payload.date) : null;
  if (!date || Number.isNaN(date.getTime())) throw fail("Date/heure invalide.", 400);
  let link = null;
  if (payload.link) {
    try {
      const url = new URL(String(payload.link).trim());
      if (url.protocol !== "https:") throw new Error();
      link = url.toString();
    } catch {
      throw fail("Le lien doit commencer par https://", 400);
    }
  }
  await interviewRepo.update(id, { status: "SCHEDULED", scheduled_at: date, meet_link: link });
  await notificationService.notify(interview.student_id, {
    type: "INTERVIEW_SCHEDULED",
    title: "Entretien programmé",
    body: `Votre entretien d'orientation (${interview.country_name}) est prévu le ${date.toLocaleString("fr-FR")}.${link ? " Un lien de visio est disponible dans votre espace." : ""}`,
    link: "/espace"
  }).catch(() => {});
  return dto(await interviewRepo.findById(id));
}

// picks : [{ universityId | universityName, fieldOfStudy }], 1 à 3.
async function chooseUniversities(auth, id, payload) {
  const interview = await interviewRepo.findById(id);
  if (!interview) throw fail("Entretien introuvable.", 404);
  await assertHandler(auth, interview);
  if (interview.status === "COMPLETED") throw fail("Les universités ont déjà été choisies pour cet entretien.", 400);
  const picks = Array.isArray(payload.picks) ? payload.picks : [];
  if (picks.length < 1 || picks.length > MAX_PICKS) throw fail(`Choisissez entre 1 et ${MAX_PICKS} universités.`, 400);

  const choiceService = require("./universityChoiceService");
  const current = await choiceService.listForStudent(auth, interview.student_id);
  if (current.used + picks.length > choiceService.MAX_ACTIVE_CHOICES) {
    throw fail(`L'étudiant a déjà ${current.used} candidature(s) en cours : maximum ${choiceService.MAX_ACTIVE_CHOICES} en même temps.`, 409);
  }
  for (const pick of picks) {
    try {
      await choiceService.addChoice(auth, interview.student_id, {
        countryId: interview.country_id,
        universityId: pick.universityId,
        universityName: pick.universityName,
        fieldOfStudy: pick.fieldOfStudy
      });
    } catch (error) {
      // Déjà ajoutée lors d'une tentative précédente interrompue : on poursuit.
      if (error.status === 409 && /font déjà partie/.test(error.message)) continue;
      throw error;
    }
  }
  await interviewRepo.update(id, { status: "COMPLETED", completed_at: new Date() });

  const profile = await studentRepo.ensureProfile(interview.student_id);
  const body = `Entretien terminé : ${picks.length} université${picks.length > 1 ? "s" : ""} choisie${picks.length > 1 ? "s" : ""} en ${interview.country_name}. Vous pouvez maintenant déposer les documents propres à chaque université.`;
  await notificationService.notify(interview.student_id, { type: "INTERVIEW_COMPLETED", title: "Universités choisies", body, link: "/espace" }).catch(() => {});
  if (profile.assigned_sales_id) {
    await notificationService.notify(profile.assigned_sales_id, {
      type: "INTERVIEW_COMPLETED",
      title: "Universités choisies",
      body: `${interview.prenom} ${interview.nom} : ${body}`,
      link: `/conseiller/etudiants/${interview.student_id}`
    }).catch(() => {});
  }
  return dto(await interviewRepo.findById(id));
}

module.exports = { requestInterview, listMineForRdv, listForStudent, schedule, chooseUniversities };
