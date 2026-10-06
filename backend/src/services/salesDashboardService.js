const repo = require("../repositories/salesDashboardRepository");
const settings = require("../repositories/settingsRepository");
const passport = require("./passport");
const paymentService = require("./paymentService");
const { PIPELINE_STAGES, computeStage } = require("./pipelineStage");

const DAY_MS = 24 * 3600 * 1000;

function daysSince(value) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS));
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n > 1 ? many : one}`;
}

// Ce qu'il faut traiter pour un étudiant, des plus urgents aux moins urgents.
// « tone » colore la ligne (danger / warning / info), « weight » ordonne la liste.
function attentionFor({ student, docs, payment, stage, passportInfo, stalledDays }) {
  const items = [];
  if (docs.toReview > 0) {
    items.push({ key: "docs-review", tone: "warning", weight: 90, text: `${plural(docs.toReview, "document")} à valider` });
  }
  if (payment?.late) {
    items.push({ key: "payment", tone: "danger", weight: 95, text: "Paiement en retard" });
  }
  if (passportInfo.status === "EXPIRED") {
    items.push({ key: "passport", tone: "danger", weight: 80, text: "Passeport expiré" });
  } else if (passportInfo.status === "EXPIRING") {
    items.push({ key: "passport", tone: "warning", weight: 60, text: "Passeport à renouveler" });
  }
  if (!student.onboardingCompleted) {
    const days = daysSince(student.createdAt);
    if (days >= 2) items.push({ key: "onboarding", tone: "info", weight: 50, text: `Onboarding non terminé depuis ${plural(days, "jour")}` });
  } else if (stage === "no_application") {
    const days = daysSince(student.onboardingCompletedAt || student.createdAt);
    if (days >= stalledDays) items.push({ key: "stalled", tone: "warning", weight: 70, text: `Sans candidature depuis ${plural(days, "jour")}` });
  }
  if (stage === "accepted") {
    items.push({ key: "visa-docs", tone: "info", weight: 75, text: "Accepté : préparer les documents visa" });
  }
  if (stage === "visa_rejected" || stage === "rejected") {
    items.push({ key: "rejected", tone: "danger", weight: 65, text: stage === "visa_rejected" ? "Visa refusé : proposer une suite" : "Candidature refusée : proposer une autre faculté" });
  }
  return items.sort((a, b) => b.weight - a.weight);
}

async function getOverview(auth) {
  const salesId = auth.sub;
  const [rows, docRows, appRows, choiceRows, plans, stalled] = await Promise.all([
    repo.listStudents(salesId),
    repo.documentCounts(salesId),
    repo.activeApplications(salesId),
    repo.choiceCounts(salesId),
    paymentService.listPlans({ salesId }),
    settings.getStalledAlertConfig()
  ]);

  const docsBy = new Map(docRows.map((r) => [r.student_id, { toReview: Number(r.to_review), rejected: Number(r.rejected), validated: Number(r.validated) }]));
  const appsBy = new Map();
  for (const app of appRows) {
    const list = appsBy.get(app.student_id) || [];
    list.push(app);
    appsBy.set(app.student_id, list);
  }
  const choicesBy = new Map(choiceRows.map((r) => [r.student_id, r.n]));
  const plansBy = new Map();
  for (const plan of plans) {
    const list = plansBy.get(plan.studentId) || [];
    list.push(plan);
    plansBy.set(plan.studentId, list);
  }

  const students = rows.map((row) => {
    const apps = appsBy.get(row.id) || [];
    const latest = apps[0] || null; // trié par mise à jour décroissante
    const student = {
      id: row.id,
      onboardingCompleted: Boolean(row.onboarding_completed),
      onboardingCompletedAt: row.onboarding_completed_at,
      createdAt: row.created_at
    };
    const stage = computeStage(student, latest);
    const expiresOn = passport.formatExpiry(row.passport_expires_on);
    const passportStatus = passport.passportStatus({ hasPassport: row.has_passport, expiresOn });
    const parsedExpiry = expiresOn ? passport.parseExpiry(expiresOn) : null;
    const docs = docsBy.get(row.id) || { toReview: 0, rejected: 0, validated: 0 };
    const studentPlans = plansBy.get(row.id) || [];
    const payment = studentPlans.length
      ? {
          late: studentPlans.some((p) => p.late),
          status: studentPlans.every((p) => p.status === "PAID") ? "PAID" : studentPlans.some((p) => p.paidTotal > 0) ? "PARTIAL" : "UNPAID",
          remaining: studentPlans.filter((p) => p.remainingTotal > 0).map((p) => ({ currency: p.currency, amount: p.remainingTotal }))
        }
      : null;
    const attention = attentionFor({
      student,
      docs,
      payment,
      stage,
      passportInfo: { status: passportStatus },
      stalledDays: stalled.days || 7
    });
    const nextInterview = apps
      .filter((a) => a.status === "INTERVIEW_SCHEDULED" && a.interview_date && new Date(a.interview_date).getTime() > Date.now() - 2 * 3600 * 1000)
      .sort((a, b) => new Date(a.interview_date) - new Date(b.interview_date))[0];
    return {
      id: row.id,
      prenom: row.prenom,
      nom: row.nom,
      email: row.email,
      phone: row.phone || "",
      city: row.city || "",
      avatarUrl: row.avatar_url || "",
      isActive: row.is_active !== false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      preferredCountries: row.preferred_countries || [],
      targetField: row.target_field || "",
      onboardingCompleted: student.onboardingCompleted,
      stage,
      docs,
      passport: { status: passportStatus, expiresOn: expiresOn || "", monthsLeft: parsedExpiry ? passport.monthsLeft(parsedExpiry) : null },
      payment,
      choices: choicesBy.get(row.id) || 0,
      application: latest
        ? { id: latest.id, status: latest.status, visaStatus: latest.visa_status, universityName: latest.university_name, fieldOfStudy: latest.field_of_study || "", countryName: latest.country_name }
        : null,
      nextInterviewAt: nextInterview ? new Date(nextInterview.interview_date).toISOString() : null,
      attention,
      score: attention.reduce((max, item) => Math.max(max, item.weight), 0)
    };
  });

  students.sort((a, b) => b.score - a.score || `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`));

  const needAttention = students.filter((s) => s.attention.length > 0);
  const stageCounts = {};
  for (const s of students) stageCounts[s.stage] = (stageCounts[s.stage] || 0) + 1;

  return {
    stages: PIPELINE_STAGES,
    stageCounts,
    kpis: {
      students: students.length,
      needAttention: needAttention.length,
      docsToReview: students.reduce((sum, s) => sum + s.docs.toReview, 0),
      paymentsLate: students.filter((s) => s.payment?.late).length,
      inProgress: students.filter((s) => s.application && !["completed", "rejected", "visa_rejected"].includes(s.stage)).length,
      visasObtained: students.filter((s) => s.stage === "completed").length
    },
    students
  };
}

module.exports = { getOverview };
