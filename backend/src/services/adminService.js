const fs = require("fs");
const path = require("path");
const users = require("../repositories/userRepository");
const students = require("../repositories/studentRepository");
const sales = require("../repositories/salesRepository");
const settings = require("../repositories/settingsRepository");
const userRoles = require("../repositories/userRoleRepository");
const userPermissions = require("../repositories/userPermissionRepository");
const countryRepo = require("../repositories/countryRepository");
const universityApplications = require("../repositories/universityApplicationRepository");
const whatsapp = require("./whatsappService");
const notificationService = require("./notificationService");
const passport = require("./passport");
const emailService = require("./emailService");
const logger = require("../logger");
const env = require("../config/env");
const { hashPassword } = require("../security/password");
const { formatPgDate } = require("../dto/userDto");

const ASSIGNABLE_ROLES = ["SALES", "ADMIN", "RDV"];

const DOCUMENTS_DIR = path.join(__dirname, "../../uploads/documents");
const AVATARS_DIR = path.join(__dirname, "../../uploads/avatars");

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
    preferredCountries: row.preferred_countries || [],
    // Le tableau n'affiche que l'état et la date, jamais le numéro.
    passportStatus: passport.passportStatus({ hasPassport: row.has_passport, expiresOn: row.passport_expires_on ? passport.formatExpiry(row.passport_expires_on) : null }),
    passportExpiresOn: passport.formatExpiry(row.passport_expires_on),
    passportMonthsLeft: row.passport_expires_on && passport.parseExpiry(passport.formatExpiry(row.passport_expires_on))
      ? passport.monthsLeft(passport.parseExpiry(passport.formatExpiry(row.passport_expires_on)))
      : null
  };
}

// Étapes détaillées du pipeline, de la moins à la plus avancée. Un étudiant
// peut avoir plusieurs candidatures (une par pays) : on retient celle mise à
// jour le plus récemment pour représenter son avancement global.
const { PIPELINE_STAGES, computeStage } = require("./pipelineStage");

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
      tone: "success",
      // Bonne nouvelle : rien à régler, on ouvre la fiche de l'étudiant.
      link: `/conseiller/etudiants/${success.student_id}`,
      actionLabel: "Voir le dossier"
    });
  }

  // « Acceptés sans RDV » : suivi par la carte du Dashboard (Indicateurs clés), plus d'alerte en doublon.

  for (const student of all.filter(matches)) {
    if (student.onboardingCompleted && !student.assignedSalesId) {
      alerts.push({
        id: `nosales-${student.id}`,
        studentId: student.id,
        student: `${student.prenom} ${student.nom}`,
        sales: "—",
        problem: "Étudiant sans conseiller",
        sinceDays: daysSince(student.onboardingCompletedAt || student.createdAt),
        tone: "danger",
        // Tableau d'affectation (Équipe) : on y donne un conseiller à l'étudiant.
        link: "/admin/users?tab=conseillers&focus=affectation",
        actionLabel: "Affecter un conseiller"
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
        tone: "danger",
        // Le bouton « transférer » de sa colonne déplace tout son travail.
        link: "/admin/users?tab=conseillers&focus=affectation",
        actionLabel: "Transférer ses dossiers"
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
      tone: "warning",
      link: "/admin/users?tab=conseillers&focus=affectation",
      actionLabel: "Rééquilibrer"
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

async function getSettings() {
  const [autoAssignSales, stalledAlert, emailSender, workHours] = await Promise.all([
    settings.isAutoAssignEnabled(),
    settings.getStalledAlertConfig(),
    settings.getEmailSenderConfig(),
    settings.getWorkHoursConfig()
  ]);
  return {
    autoAssignSales,
    stalledAlertDays: stalledAlert.days,
    stalledAlertFrequency: stalledAlert.frequency,
    stalledAlertEmail: stalledAlert.email,
    emailFromName: emailSender.fromName,
    emailFromAddress: emailSender.fromAddress,
    emailHasAppPassword: emailSender.hasAppPassword,
    emailSmtpHost: emailSender.smtpHost,
    emailSmtpPort: emailSender.smtpPort,
    workDays: String(workHours.days).split(",").map((d) => parseInt(d, 10)).filter((d) => d >= 1 && d <= 7),
    workStart: workHours.start,
    workEnd: workHours.end,
    workTimezone: workHours.timezone
  };
}

async function updateSettings(body) {
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
    body.emailFromName !== undefined ||
    body.emailFromAddress !== undefined ||
    body.emailAppPassword !== undefined ||
    body.emailSmtpHost !== undefined ||
    body.emailSmtpPort !== undefined;
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

    const smtpHost = body.emailSmtpHost !== undefined ? String(body.emailSmtpHost).trim().toLowerCase() : undefined;
    if (smtpHost !== undefined && smtpHost && !/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(smtpHost)) {
      throw fail("Serveur d'envoi invalide.", 400);
    }
    const smtpPort = body.emailSmtpPort !== undefined && body.emailSmtpPort !== "" && body.emailSmtpPort !== null
      ? parseInt(body.emailSmtpPort, 10)
      : body.emailSmtpPort === undefined ? undefined : null;
    if (smtpPort && (!Number.isInteger(smtpPort) || ![465, 587].includes(smtpPort))) {
      throw fail("Port invalide : utilisez 465 (SSL) ou 587.", 400);
    }

    // On teste la connexion AVANT d'enregistrer : un mauvais couple
    // adresse / serveur / mot de passe casserait tous les emails de la
    // plateforme (vérification de compte, entretiens, alertes) sans qu'on
    // s'en aperçoive.
    const secrets = await settings.getEmailSenderSecrets();
    const effective = {
      host: (smtpHost !== undefined ? smtpHost : secrets.smtpHost) || emailService.guessSmtpHost(fromAddress) || env.smtp.host,
      port: (smtpPort !== undefined ? smtpPort : secrets.smtpPort) || env.smtp.port,
      user: fromAddress || env.smtp.user,
      pass: appPassword || secrets.appPassword || env.smtp.pass
    };
    const problem = await emailService.verifySmtp(effective);
    if (problem) throw fail(`Rien n'a été enregistré. ${problem}`, 400);

    await settings.setEmailSenderConfig({ fromName, fromAddress, appPassword, smtpHost, smtpPort });
  }

  const touchesWorkHours =
    body.workDays !== undefined ||
    body.workStart !== undefined ||
    body.workEnd !== undefined ||
    body.workTimezone !== undefined ||
    body.workHalfwayMinutes !== undefined;
  if (touchesWorkHours) {
    const current = await settings.getWorkHoursConfig();
    let days = current.days;
    if (body.workDays !== undefined) {
      const parsed = (Array.isArray(body.workDays) ? body.workDays : String(body.workDays).split(","))
        .map((d) => parseInt(d, 10))
        .filter((d) => settings.WEEKDAY_IDS.includes(d));
      if (!parsed.length) throw fail("Choisissez au moins un jour ouvré.", 400);
      days = [...new Set(parsed)].sort((a, b) => a - b).join(",");
    }
    const hm = (value, fallback) => {
      const raw = value !== undefined ? String(value).trim() : fallback;
      if (!/^\d{1,2}:\d{2}$/.test(raw)) throw fail("Les horaires doivent être au format HH:MM.", 400);
      return raw.length === 4 ? `0${raw}` : raw;
    };
    const start = hm(body.workStart, current.start);
    const end = hm(body.workEnd, current.end);
    const timezone = body.workTimezone !== undefined ? String(body.workTimezone).trim() || "Africa/Tunis" : current.timezone;
    await settings.setWorkHoursConfig({ days, start, end, timezone });
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
  await whatsapp.distributeOrphans();
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
  if (isActive) {
    await whatsapp.distributeOrphans();
  } else {
    await whatsapp.onSalesDeactivated(salesId);
  }
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
  await whatsapp.onSalesTransferred(fromSalesId, toSalesId);
  if (transferred > 0) {
    await notificationService.notify(toSalesId, {
      type: "STUDENT_ASSIGNED",
      title: `${transferred} étudiant${transferred > 1 ? "s" : ""} transféré${transferred > 1 ? "s" : ""}`,
      body: `Les étudiants de ${from.prenom} ${from.nom} vous ont été transférés.`,
      link: "/conseiller"
    });
  }
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
      "Ce compte a des données associées (étudiants, candidatures, commissions ou conversations WhatsApp) : utilisez \"Transférer + Bloquer\" plutôt que de le supprimer.",
      409
    );
  }

  await users.deleteById(salesId);
  return { id: salesId };
}

// ── Suppression d'un étudiant ─────────────────────────────────────────────
// Suppression DÉFINITIVE (compte, profil, documents, candidatures, historique,
// notifications) pour nettoyer un compte de test ou créé par erreur, ou pour
// effacer les données d'une personne qui le demande. Une seule limite : un
// étudiant pour qui une commission a été gagnée ne se supprime pas (les gains
// des conseillers / RDV partiraient avec lui) : on le bloque à la place.
async function loadDeletableStudent(studentId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(studentId))) throw fail("Étudiant introuvable.", 404);
  const user = await users.findById(studentId);
  if (!user || user.role !== "STUDENT") throw fail("Étudiant introuvable.", 404);
  return user;
}

async function getStudentDeletionPreview(studentId) {
  const user = await loadDeletableStudent(studentId);
  const linked = await users.countStudentLinkedData(studentId);
  return {
    id: user.id,
    name: `${user.prenom} ${user.nom}`.trim(),
    email: user.email,
    ...linked,
    // Bloque la suppression : l'interface propose « Bloquer » à la place.
    canDelete: linked.commissions === 0
  };
}

function removeFileQuietly(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") logger.warn("Suppression d'un fichier d'étudiant impossible", { file: path.basename(filePath), message: error.message });
  }
}

async function deleteStudent(adminId, studentId) {
  const user = await loadDeletableStudent(studentId);
  const linked = await users.countStudentLinkedData(studentId);
  if (linked.commissions > 0) {
    throw fail(
      `Cet étudiant a généré ${linked.commissions} commission${linked.commissions > 1 ? "s" : ""} pour des conseillers ou des RDV : le supprimer effacerait ces gains. Bloquez son compte à la place.`,
      409
    );
  }

  // Liste des fichiers AVANT la suppression : après, les lignes n'existent plus.
  const files = await users.listStudentFiles(studentId);
  await users.deleteStudentById(studentId);

  for (const stored of files.documents) removeFileQuietly(path.join(DOCUMENTS_DIR, path.basename(stored)));
  if (files.avatarUrl.startsWith("/uploads/avatars/")) {
    removeFileQuietly(path.join(AVATARS_DIR, path.basename(files.avatarUrl.split("?")[0])));
  }

  // Trace d'audit : qui a supprimé quel compte, sans conserver de données personnelles.
  logger.info("Étudiant supprimé", { adminId, studentId, documents: linked.documents, applications: linked.applications });
  return { id: studentId };
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

module.exports = { getBoard, getDashboard, getStudentsOverview, setStudentActive, getSettings, updateSettings, createSales, setSalesActive, transferAndBlockSales, deleteSales, getStudentDeletionPreview, deleteStudent, getUserAccess, setUserRoles, setUserPermissions, createRdv, listRdv, listRdvAssignments, listRdvStudents, setRdvCountries, listUnassignedVisaApplications };
