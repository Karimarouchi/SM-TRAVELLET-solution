const users = require("../repositories/userRepository");
const students = require("../repositories/studentRepository");
const sales = require("../repositories/salesRepository");
const settings = require("../repositories/settingsRepository");
const userRoles = require("../repositories/userRoleRepository");
const userPermissions = require("../repositories/userPermissionRepository");
const countryRepo = require("../repositories/countryRepository");
const universityApplications = require("../repositories/universityApplicationRepository");
const { hashPassword } = require("../security/password");
const { formatPgDate } = require("../dto/userDto");

const ASSIGNABLE_ROLES = ["SALES", "ADMIN", "RDV"];

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapStudent(row) {
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    email: row.email,
    dateNaissance: formatPgDate(row.date_naissance),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    onboardingCompleted: Boolean(row.onboarding_completed),
    onboardingCompletedAt: row.onboarding_completed_at
      ? new Date(row.onboarding_completed_at).toISOString()
      : null,
    assignedSalesId: row.assigned_sales_id || null,
    avatarUrl: row.avatar_url || "",
    residenceCountry: row.residence_country || "",
    targetField: row.target_field || "",
    phone: row.phone || "",
    city: row.city || "",
    currentStudyLevel: row.current_study_level || "",
    preferredCountries: row.preferred_countries || []
  };
}

// Étapes détaillées du pipeline, de la moins à la plus avancée. Un étudiant
// peut avoir plusieurs candidatures (une par pays) : on retient celle mise à
// jour le plus récemment pour représenter son avancement global.
const PIPELINE_STAGES = [
  { key: "onboarding", label: "Onboarding en cours" },
  { key: "ready_to_apply", label: "Prêt à postuler" },
  { key: "applied", label: "Candidature déposée" },
  { key: "waiting_response", label: "En attente de l'université" },
  { key: "interview", label: "Entretien" },
  { key: "accepted", label: "Accepté par l'université" },
  { key: "visa_preparation", label: "Visa en préparation" },
  { key: "visa_submitted", label: "Visa déposé" },
  { key: "completed", label: "Visa obtenu · Dossier terminé" },
  { key: "rejected", label: "Candidature refusée" },
  { key: "visa_rejected", label: "Visa refusé" },
  { key: "no_application", label: "Onboarding terminé, sans candidature" }
];

function computeStage(student, latestApp) {
  if (!student.onboardingCompleted) return "onboarding";
  if (!latestApp) return "no_application";
  if (latestApp.status === "REJECTED") return "rejected";
  if (latestApp.status === "ACCEPTED") {
    if (latestApp.visa_status === "ACCEPTED") return "completed";
    if (latestApp.visa_status === "REJECTED") return "visa_rejected";
    if (latestApp.visa_status === "SUBMITTED") return "visa_submitted";
    if (latestApp.visa_status === "PREPARATION") return "visa_preparation";
    return "accepted";
  }
  if (["INTERVIEW_REQUIRED", "INTERVIEW_SCHEDULED", "INTERVIEW_COMPLETED"].includes(latestApp.status)) return "interview";
  if (latestApp.status === "WAITING_UNIVERSITY_RESPONSE") return "waiting_response";
  if (latestApp.status === "APPLIED") return "applied";
  return "ready_to_apply";
}

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// Croissance réelle mois par mois (cumulée), année en cours vs précédente —
// remplace une ancienne version qui générait les valeurs avec Math.random().
function buildMonthlyGrowth(studentsList) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;
  const monthsToShow = now.getMonth() + 1;
  const dates = studentsList.map((s) => (s.createdAt ? new Date(s.createdAt) : null)).filter(Boolean);

  const result = [];
  for (let m = 0; m < monthsToShow; m++) {
    const current = dates.filter((d) => d.getFullYear() === currentYear && d.getMonth() <= m).length;
    const previous = dates.filter((d) => d.getFullYear() === previousYear && d.getMonth() <= m).length;
    result.push({ month: MONTHS_FR[m], current, previous });
  }
  return result;
}

function periodBounds(period) {
  const now = new Date();
  if (period === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - 7);
    return { start, prevStart, prevEnd: start };
  }
  if (period === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const prevStart = new Date(now.getFullYear() - 1, 0, 1);
    return { start, prevStart, prevEnd: start };
  }
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { start, prevStart, prevEnd: start };
  }
  return { start: null, prevStart: null, prevEnd: null };
}

function inRange(iso, start, end) {
  if (!iso) return false;
  const date = new Date(iso);
  if (start && date < start) return false;
  if (end && date >= end) return false;
  return true;
}

function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function compareLabel(current, previous) {
  const delta = current - previous;
  if (previous === 0 && current === 0) return "Stable";
  if (previous === 0) return `+${current} vs période préc.`;
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct} % · ${delta >= 0 ? "+" : ""}${delta}`;
}

async function getBoard() {
  const [salesRows, allStudentsResult, autoAssignSales] = await Promise.all([
    sales.listBoard(),
    students.listAll({ pageSize: 100000 }),
    settings.isAutoAssignEnabled()
  ]);
  const mapped = allStudentsResult.rows.map(mapStudent);
  return {
    autoAssignSales,
    unassigned: mapped.filter((item) => !item.assignedSalesId),
    sales: salesRows.map((row) => ({
      id: row.id,
      prenom: row.prenom,
      nom: row.nom,
      email: row.email,
      phone: row.phone || "",
      jobTitle: row.job_title || "Conseiller",
      isActive: row.is_active !== false,
      studentCount: row.student_count,
      students: mapped.filter((item) => item.assignedSalesId === row.id)
    }))
  };
}

async function getDashboard(query = {}) {
  const period = ["week", "month", "year", "all"].includes(query.period) ? query.period : "month";
  const salesId = String(query.salesId || "").trim();
  const destination = String(query.destination || "").trim();
  const status = String(query.status || "").trim();
  const { start, prevStart, prevEnd } = periodBounds(period);

  const [board, allRowsResult, visasObtainedMonth, stalledRows, stalledConfig, allApplications] = await Promise.all([
    getBoard(),
    students.listAll({ pageSize: 100000 }),
    universityApplications.countVisaObtainedThisMonth(),
    students.findStalledNoApplication(),
    settings.getStalledAlertConfig(),
    universityApplications.listAllActive()
  ]);
  const stalledDossiersCount = stalledRows.filter((row) => daysSince(row.onboarding_completed_at) >= stalledConfig.days).length;
  const all = allRowsResult.rows.map(mapStudent);
  const salesMap = Object.fromEntries(board.sales.map((item) => [item.id, item]));

  function matches(student) {
    if (salesId && student.assignedSalesId !== salesId) return false;
    if (destination && !(student.preferredCountries || []).includes(destination)) return false;
    if (status === "incomplete" && student.onboardingCompleted) return false;
    if (status === "complete" && !student.onboardingCompleted) return false;
    if (status === "assigned" && !student.assignedSalesId) return false;
    if (status === "unassigned" && student.assignedSalesId) return false;
    return true;
  }

  const scoped = all.filter(matches);
  const inPeriod = scoped.filter((item) => !start || inRange(item.createdAt, start, null));
  const inPrevious = scoped.filter((item) => start && inRange(item.createdAt, prevStart, prevEnd));

  const completed = scoped.filter((item) => item.onboardingCompleted);
  const incomplete = scoped.filter((item) => !item.onboardingCompleted);
  const assigned = scoped.filter((item) => item.assignedSalesId);
  const unassigned = scoped.filter((item) => !item.assignedSalesId);
  const completedUnassigned = completed.filter((item) => !item.assignedSalesId);
  const activeSales = board.sales.filter((item) => item.isActive);

  // Entonnoir de conversion réel : chaque étape est un sous-ensemble de la
  // précédente (candidature ⊆ onboarding terminé ⊆ inscrits), donc les
  // pourcentages affichés sont de vraies proportions, pas des ratios simulés.
  const scopedIds = new Set(scoped.map((item) => item.id));
  const scopedApplications = allApplications.filter((app) => scopedIds.has(app.student_id));
  const withApplicationIds = new Set(scopedApplications.map((app) => app.student_id));
  const acceptedIds = new Set(scopedApplications.filter((app) => app.status === "ACCEPTED").map((app) => app.student_id));
  const visaObtainedIds = new Set(scopedApplications.filter((app) => app.visa_status === "ACCEPTED").map((app) => app.student_id));

  const funnel = [
    { key: "inscrits", label: "Inscrits", count: scoped.length },
    { key: "onboarding_complete", label: "Onboarding terminé", count: completed.length },
    { key: "candidature", label: "Candidature déposée", count: withApplicationIds.size },
    { key: "accepte", label: "Accepté par une université", count: acceptedIds.size },
    { key: "visa_obtenu", label: "Visa obtenu", count: visaObtainedIds.size }
  ];

  const monthlyGrowth = buildMonthlyGrowth(scoped);

  const destSource = period === "all" ? scoped : inPeriod;
  const destCounts = {};
  for (const student of destSource) {
    for (const country of student.preferredCountries || []) {
      destCounts[country] = (destCounts[country] || 0) + 1;
    }
  }
  const destTotal = Object.values(destCounts).reduce((sum, value) => sum + value, 0);
  const destinations = Object.entries(destCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percent: destTotal ? Math.round((count / destTotal) * 1000) / 10 : 0
    }));

  const alerts = [];
  
  // Fetch recent successes (last 14 days)
  const recentSuccesses = await universityApplications.findRecentSuccesses(14);
  for (const success of recentSuccesses) {
    const isVisa = success.visa_status === 'OBTAINED';
    alerts.push({
      id: `success-${success.id}-${isVisa ? 'visa' : 'accepted'}`,
      studentId: success.student_id,
      student: `${success.student_prenom} ${success.student_nom}`,
      sales: success.sales_id ? `${success.sales_prenom} ${success.sales_nom}` : "—",
      problem: isVisa 
        ? `Visa obtenu pour ${success.country_name} !` 
        : `Accepté à ${success.university_name} !`,
      sinceDays: daysSince(success.updated_at),
      tone: "success"
    });
  }

  // Dossiers acceptés mais bloqués faute de RDV assigné : le visa ne peut
  // pas avancer tant qu'un RDV n'est pas affecté au dossier. L'admin peut
  // agir directement (assigner un RDV depuis la fiche étudiant).
  const stuckVisas = await universityApplications.findAcceptedWithoutRdv();
  for (const app of stuckVisas) {
    alerts.push({
      id: `no-rdv-${app.id}`,
      studentId: app.student_id,
      student: `${app.student_prenom} ${app.student_nom}`,
      sales: "—",
      problem: `Accepté à ${app.university_name} (${app.country_name}) — aucun RDV assigné pour le visa`,
      sinceDays: daysSince(app.decision_at || app.updated_at),
      tone: "danger"
    });
  }

  for (const student of all.filter(matches)) {
    if (student.onboardingCompleted && !student.assignedSalesId) {
      alerts.push({
        id: `nosales-${student.id}`,
        studentId: student.id,
        student: `${student.prenom} ${student.nom}`,
        sales: "—",
        problem: "Étudiant sans conseiller",
        sinceDays: daysSince(student.onboardingCompletedAt || student.createdAt),
        tone: "danger"
      });
    }
  }
  for (const item of board.sales) {
    if (!item.isActive && item.students.length) {
      alerts.push({
        id: `inactive-${item.id}`,
        studentId: null,
        student: `${item.students.length} étudiant(s)`,
        sales: `${item.prenom} ${item.nom}`,
        problem: "Conseiller inactif avec des dossiers",
        sinceDays: 0,
        tone: "danger"
      });
    }
  }
  const loads = activeSales.map((item) => item.students.length);
  if (loads.length >= 2 && Math.max(...loads) - Math.min(...loads) > 2) {
    alerts.push({
      id: "imbalance",
      studentId: null,
      student: "Équipe sales",
      sales: "Tous",
      problem: `Charge inégale : ${Math.min(...loads)} à ${Math.max(...loads)} étudiants`,
      sinceDays: 0,
      tone: "warning"
    });
  }
  alerts.sort((a, b) => b.sinceDays - a.sinceDays);

  const salesPerformance = board.sales
    .map((item) => {
      const mine = scoped.filter((student) => student.assignedSalesId === item.id);
      const mineCompleted = mine.filter((student) => student.onboardingCompleted).length;
      return {
        id: item.id,
        prenom: item.prenom,
        nom: item.nom,
        email: item.email,
        phone: item.phone,
        isActive: item.isActive,
        students: mine.length,
        completed: mineCompleted,
        share: scoped.length ? Math.round((mine.length / scoped.length) * 1000) / 10 : 0
      };
    })
    .sort((a, b) => b.completed - a.completed || b.students - a.students);

  // Équipe RDV : même principe que salesPerformance, mais sur les dossiers
  // visa qui leur sont attribués (deux équipes distinctes, classées
  // séparément — un RDV n'est jamais comparé à un sales).
  const rdvUsersRows = await userRoles.listUsersWithRole("RDV");
  const rdvAppsById = {};
  for (const app of allApplications) {
    if (!app.assigned_rdv_id) continue;
    (rdvAppsById[app.assigned_rdv_id] ||= []).push(app);
  }
  const totalRdvDossiers = Object.values(rdvAppsById).reduce((sum, apps) => sum + apps.length, 0);
  const rdvPerformance = rdvUsersRows
    .map((item) => {
      const apps = rdvAppsById[item.id] || [];
      const completed = apps.filter((app) => app.visa_status === "ACCEPTED").length;
      return {
        id: item.id,
        prenom: item.prenom,
        nom: item.nom,
        email: item.email,
        isActive: item.is_active !== false,
        students: apps.length,
        completed,
        share: totalRdvDossiers ? Math.round((apps.length / totalRdvDossiers) * 1000) / 10 : 0
      };
    })
    .sort((a, b) => b.completed - a.completed || b.students - a.students);

  return {
    filters: {
      period,
      salesId: salesId || "",
      destination: destination || "",
      status: status || "",
      destinations: [...new Set(all.flatMap((item) => item.preferredCountries || []))].sort(),
      sales: board.sales.map((item) => ({ id: item.id, prenom: item.prenom, nom: item.nom, isActive: item.isActive }))
    },
    kpis: {
      students: { value: scoped.length, hint: `${inPeriod.length} créé${inPeriod.length > 1 ? "s" : ""} sur la période` },
      completed: { value: completed.length, hint: `${scoped.length ? Math.round((completed.length / scoped.length) * 100) : 0} % des étudiants` },
      newcomers: { value: inPeriod.length, hint: compareLabel(inPeriod.length, inPrevious.length) },
      incomplete: { value: incomplete.length, hint: incomplete.length ? "Dossiers à relancer" : "Aucun dossier en attente" },
      activeSales: { value: activeSales.length, hint: `${board.sales.length} compte${board.sales.length > 1 ? "s" : ""} au total` },
      unassigned: { value: completedUnassigned.length, hint: `${unassigned.length} sans affectation au total` },
      visasObtainedMonth: { value: visasObtainedMonth, hint: "Visas obtenus ce mois-ci" },
      stalledDossiers: {
        value: stalledDossiersCount,
        hint: stalledDossiersCount
          ? `Sans candidature depuis plus de ${stalledConfig.days} j`
          : "Aucun dossier bloqué"
      }
    },
    pipeline: [
      { key: "inscrit", label: "Inscrits", count: scoped.length },
      { key: "incomplete", label: "Onboarding en cours", count: incomplete.length },
      { key: "complete", label: "Dossiers complets", count: completed.length },
      { key: "assigned", label: "Affectés à un sales", count: assigned.length },
      { key: "unassigned", label: "Non affectés", count: unassigned.length }
    ],
    funnel,
    monthlyGrowth,
    alerts: alerts.slice(0, 12),
    destinations,
    salesPerformance,
    rdvPerformance,
    autoAssignSales: board.autoAssignSales
  };
}

async function getStudentsOverview() {
  const [rows, applications] = await Promise.all([
    students.listAllOverview(),
    universityApplications.listAllActive()
  ]);

  const appsByStudent = new Map();
  for (const app of applications) {
    const list = appsByStudent.get(app.student_id) || [];
    list.push(app);
    appsByStudent.set(app.student_id, list);
  }

  const overview = rows.map((row) => {
    const apps = appsByStudent.get(row.id) || [];
    const latestApp = apps[0] || null; // listAllActive est déjà trié par updated_at DESC
    const student = mapStudent(row);
    return {
      ...student,
      isActive: row.is_active !== false,
      dossierStage: row.dossier_stage || "DOCUMENTS",
      assignedSalesName: row.sales_prenom ? `${row.sales_prenom} ${row.sales_nom}` : null,
      stage: computeStage(student, latestApp),
      applications: apps.map((app) => ({
        id: app.id,
        countryName: app.country_name,
        universityName: app.university_name,
        status: app.status,
        visaStatus: app.visa_status,
        updatedAt: app.updated_at ? new Date(app.updated_at).toISOString() : null
      }))
    };
  });

  return { stages: PIPELINE_STAGES, students: overview };
}

async function setStudentActive(studentId, isActive) {
  const user = await users.findById(studentId);
  if (!user || user.role !== "STUDENT") {
    throw fail("Étudiant introuvable.", 404);
  }
  const updated = await users.setActive(studentId, isActive);
  return { id: updated.id, isActive: updated.is_active !== false };
}

async function setAutoAssign(enabled) {
  await settings.set("auto_assign_sales", enabled ? "true" : "false");
  return { autoAssignSales: Boolean(enabled) };
}

async function getSettings() {
  const [autoAssignSales, stalledAlert, emailSender] = await Promise.all([
    settings.isAutoAssignEnabled(),
    settings.getStalledAlertConfig(),
    settings.getEmailSenderConfig()
  ]);
  return {
    autoAssignSales,
    stalledAlertDays: stalledAlert.days,
    stalledAlertFrequency: stalledAlert.frequency,
    stalledAlertEmail: stalledAlert.email,
    emailFromName: emailSender.fromName,
    emailFromAddress: emailSender.fromAddress,
    emailHasAppPassword: emailSender.hasAppPassword
  };
}

async function updateSettings(body) {
  if (typeof body.autoAssignSales === "boolean") {
    await settings.set("auto_assign_sales", body.autoAssignSales ? "true" : "false");
  }

  // Les réglages de l'alerte "dossier bloqué" ne sont touchés que si l'appel
  // les fournit explicitement — sinon un simple toggle de l'affectation auto
  // (qui n'envoie que autoAssignSales) échouerait faute de seuil/fréquence.
  const touchesStalledAlert =
    body.stalledAlertDays !== undefined || body.stalledAlertFrequency !== undefined || body.stalledAlertEmail !== undefined;

  if (touchesStalledAlert) {
    const current = await settings.getStalledAlertConfig();

    const days = body.stalledAlertDays !== undefined ? parseInt(body.stalledAlertDays, 10) : current.days;
    if (!Number.isInteger(days) || days < 1) throw fail("Le seuil de jours doit être un entier positif.", 400);

    const frequency = body.stalledAlertFrequency !== undefined ? String(body.stalledAlertFrequency) : current.frequency;
    if (!settings.STALLED_ALERT_FREQUENCIES.includes(frequency)) {
      throw fail("Fréquence de rappel invalide.", 400);
    }

    const email = body.stalledAlertEmail !== undefined ? String(body.stalledAlertEmail).trim() : current.email;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw fail("Adresse email invalide.", 400);
    }

    await settings.setStalledAlertConfig({ days, frequency, email });
  }

  const touchesEmailSender =
    body.emailFromName !== undefined || body.emailFromAddress !== undefined || body.emailAppPassword !== undefined;
  if (touchesEmailSender) {
    const current = await settings.getEmailSenderConfig();
    const fromName = body.emailFromName !== undefined ? String(body.emailFromName).trim() : current.fromName;
    const fromAddress = body.emailFromAddress !== undefined ? String(body.emailFromAddress).trim() : current.fromAddress;
    if (fromAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
      throw fail("Adresse email d'expédition invalide.", 400);
    }
    // Un mot de passe vide dans le formulaire signifie "je ne le change pas",
    // pas "je le supprime" — setEmailSenderConfig ignore déjà les valeurs
    // vides pour ce champ.
    const appPassword = body.emailAppPassword !== undefined ? String(body.emailAppPassword) : undefined;
    await settings.setEmailSenderConfig({ fromName, fromAddress, appPassword });
  }

  return getSettings();
}

async function createSales(body) {
  const prenom = String(body.prenom || "").trim();
  const nom = String(body.nom || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const phone = String(body.phone || "").trim();

  if (prenom.length < 2) throw Object.assign(new Error("Le prénom est obligatoire."), { status: 400 });
  if (nom.length < 2) throw Object.assign(new Error("Le nom est obligatoire."), { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Adresse email invalide."), { status: 400 });
  }
  if (password.length < 8) throw Object.assign(new Error("Le mot de passe doit contenir au moins 8 caractères."), { status: 400 });
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    throw Object.assign(new Error("Le téléphone doit contenir entre 8 et 15 chiffres."), { status: 400 });
  }
  if (await users.findByEmail(email)) {
    throw Object.assign(new Error("Un compte existe déjà avec cet email."), { status: 409 });
  }

  const { salt, hash } = hashPassword(password);
  const user = await users.createUser({
    prenom,
    nom,
    email,
    dateNaissance: "1990-01-01",
    salt,
    hash,
    role: "SALES"
  });
  await sales.updatePhone(user.id, phone);
  return {
    id: user.id,
    prenom: user.prenom,
    nom: user.nom,
    email: user.email,
    phone,
    isActive: true,
    role: "SALES"
  };
}

async function setSalesActive(salesId, isActive) {
  const user = await users.findById(salesId);
  if (!user || user.role !== "SALES") {
    throw Object.assign(new Error("Conseiller introuvable."), { status: 404 });
  }
  const updated = await users.setActive(salesId, isActive);
  return { id: updated.id, isActive: updated.is_active !== false };
}

// Remplace un conseiller : ses étudiants en cours sont transférés à un autre
// sales, puis son compte est bloqué. Pas de suppression réelle — l'historique
// (commissions, conversations) reste intact, comme choisi pour éviter toute
// perte de données irréversible.
async function transferAndBlockSales(fromSalesId, toSalesId) {
  const from = await users.findById(fromSalesId);
  if (!from || from.role !== "SALES") throw fail("Conseiller introuvable.", 404);

  if (fromSalesId === toSalesId) throw fail("Choisissez un autre conseiller pour le transfert.", 400);

  const to = await users.findById(toSalesId);
  if (!to || to.role !== "SALES") throw fail("Conseiller de destination introuvable.", 404);
  if (to.is_active === false) throw fail("Le conseiller de destination doit être actif.", 400);

  const transferred = await students.reassignAllFromSales(fromSalesId, toSalesId);
  const updated = await users.setActive(fromSalesId, false);
  return { id: updated.id, isActive: updated.is_active !== false, transferred };
}

// Suppression DÉFINITIVE, réservée aux comptes créés par erreur et jamais
// utilisés : refusée dès qu'il existe la moindre donnée liée (étudiant,
// candidature, commission, conversation), auquel cas il faut passer par
// "Transférer + Bloquer" pour ne perdre aucun historique réel.
async function deleteSales(salesId) {
  const user = await users.findById(salesId);
  if (!user || user.role !== "SALES") throw fail("Conseiller introuvable.", 404);

  const linked = await users.countSalesLinkedData(salesId);
  const total = linked.students + linked.applications + linked.commissions + linked.conversations;
  if (total > 0) {
    throw fail(
      "Ce compte a des données associées (étudiants, candidatures, commissions ou conversations) : utilisez \"Transférer + Bloquer\" plutôt que de le supprimer.",
      409
    );
  }

  await users.deleteById(salesId);
  return { id: salesId };
}

async function createRdv(body) {
  const prenom = String(body.prenom || "").trim();
  const nom = String(body.nom || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (prenom.length < 2) throw fail("Le prénom est obligatoire.", 400);
  if (nom.length < 2) throw fail("Le nom est obligatoire.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail("Adresse email invalide.", 400);
  if (password.length < 8) throw fail("Le mot de passe doit contenir au moins 8 caractères.", 400);
  if (await users.findByEmail(email)) throw fail("Un compte existe déjà avec cet email.", 409);

  const { salt, hash } = hashPassword(password);
  const user = await users.createUser({
    prenom,
    nom,
    email,
    dateNaissance: "1990-01-01",
    salt,
    hash,
    role: "RDV"
  });
  return { id: user.id, prenom: user.prenom, nom: user.nom, email: user.email, isActive: true, role: "RDV" };
}

async function setUserPermissions(userId, permissions) {
  const user = await users.findById(userId);
  if (!user) throw fail("Utilisateur introuvable.", 404);
  const requested = Array.isArray(permissions) ? permissions.filter((p) => userPermissions.PERMISSIONS.includes(p)) : [];
  await userPermissions.setForUser(userId, requested);
  return { id: user.id, permissions: requested };
}

async function getUserAccess(userId) {
  const user = await users.findById(userId);
  if (!user) throw fail("Utilisateur introuvable.", 404);
  const roles = await userRoles.getEffectiveRoles(user);
  const permissions = await userPermissions.listForUser(userId);
  return { id: user.id, baseRole: user.role, roles, permissions };
}

async function setUserRoles(userId, roles) {
  const user = await users.findById(userId);
  if (!user) throw fail("Utilisateur introuvable.", 404);

  const requested = Array.isArray(roles) ? roles.filter((r) => ASSIGNABLE_ROLES.includes(r)) : [];
  if (requested.some((r) => !ASSIGNABLE_ROLES.includes(r))) {
    throw fail("Rôle invalide.", 400);
  }
  // On ne stocke que les rôles ADDITIONNELS (différents du rôle de base) :
  // le rôle de base reste géré ailleurs (création de compte), user_roles ne
  // porte que ce qui s'ajoute par-dessus.
  const additional = requested.filter((r) => r !== user.role);
  await userRoles.setAdditionalRoles(userId, additional);
  const effective = await userRoles.getEffectiveRoles(user);
  return { id: user.id, baseRole: user.role, roles: effective };
}

// Candidatures acceptées mais sans RDV assigné — le "non attribués" du
// tableau de glisser-déposer des dossiers visa (même logique que l'alerte
// "dossier bloqué" du dashboard).
async function listUnassignedVisaApplications() {
  const rows = await universityApplications.findAcceptedWithoutRdv();
  return rows.map((app) => ({
    id: app.id,
    studentId: app.student_id,
    studentName: `${app.student_prenom} ${app.student_nom}`.trim(),
    countryName: app.country_name,
    universityName: app.university_name,
    decisionAt: app.decision_at ? new Date(app.decision_at).toISOString() : null
  }));
}

async function listRdv() {
  const rows = await userRoles.listUsersWithRole("RDV");
  return rows.map((r) => ({ id: r.id, prenom: r.prenom, nom: r.nom, email: r.email, isActive: r.is_active !== false }));
}

async function listRdvAssignments() {
  const rows = await userRoles.listAllRdvAssignments();
  return rows.map((r) => ({ rdvUserId: r.rdv_user_id, countryId: r.country_id, rdvName: `${r.prenom} ${r.nom}`.trim(), countryName: r.country_name }));
}

async function listRdvStudents(rdvUserId) {
  const user = await users.findById(rdvUserId);
  if (!user) throw fail("Utilisateur introuvable.", 404);
  const rows = await universityApplications.listForRdv(rdvUserId);
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: `${r.student_prenom} ${r.student_nom}`.trim(),
    studentEmail: r.student_email,
    countryId: r.country_id,
    countryName: r.country_name,
    universityId: r.university_id,
    universityName: r.university_name,
    programmeTitle: r.programme_title,
    status: r.status,
    updatedAt: r.updated_at
  }));
}

async function setRdvCountries(rdvUserId, countryIds) {
  const user = await users.findById(rdvUserId);
  if (!user) throw fail("Utilisateur introuvable.", 404);
  const effective = await userRoles.getEffectiveRoles(user);
  if (!effective.includes("RDV")) throw fail("Cet utilisateur n'a pas le rôle RDV.", 400);

  const ids = Array.isArray(countryIds) ? countryIds : [];
  for (const id of ids) {
    if (!(await countryRepo.findById(id))) throw fail("Pays introuvable.", 404);
  }
  await userRoles.setRdvCountries(rdvUserId, ids);
  return { rdvUserId, countryIds: ids };
}

module.exports = { getBoard, getDashboard, getStudentsOverview, setStudentActive, setAutoAssign, getSettings, updateSettings, createSales, setSalesActive, transferAndBlockSales, deleteSales, getUserAccess, setUserRoles, setUserPermissions, createRdv, listRdv, listRdvAssignments, listRdvStudents, setRdvCountries, listUnassignedVisaApplications };
