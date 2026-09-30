const settings = require("../repositories/settingsRepository");
const performanceRepo = require("../repositories/performanceRepository");
const { parseWorkHours, businessMinutesBetween, formatMinutes, average } = require("./businessHours");

function staffDto(id, prenom, nom, email, extra = {}) {
  return { id, prenom: prenom || "", nom: nom || "", email: email || "", ...extra };
}

function emptySalesBucket(row) {
  return staffDto(row.sales_id, row.prenom, row.nom, row.email, {
    isActive: row.is_active !== false,
    students: 0,
    documentsValidated: 0,
    avgAssignToDocsMinutes: 0,
    avgAssignToDocsLabel: "—",
    halfwayDossiers: 0,
    whatsappConversationsWeek: 0,
    whatsappConversationsMonth: 0,
    avgWhatsappReplyMinutes: 0,
    avgWhatsappReplyLabel: "—"
  });
}

async function getWorkHoursReport() {
  const config = parseWorkHours(await settings.getWorkHoursConfig());
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [salesRows, applications, replyPairs, weekCounts, monthCounts] = await Promise.all([
    performanceRepo.listSalesStudents(),
    performanceRepo.listApplicationsForTiming(),
    performanceRepo.listWhatsAppReplyPairs(),
    performanceRepo.listWhatsAppConversationCounts(weekStart),
    performanceRepo.listWhatsAppConversationCounts(monthStart)
  ]);

  const salesById = new Map();
  for (const row of salesRows) {
    if (!salesById.has(row.sales_id)) salesById.set(row.sales_id, emptySalesBucket(row));
    if (!row.student_id) continue;
    const bucket = salesById.get(row.sales_id);
    bucket.students += 1;
  }

  const docsMinutesBySales = new Map();
  const halfwayBySales = new Map();
  for (const row of salesRows) {
    if (!row.student_id) continue;
    const assignedAt = row.onboarding_completed_at || row.assigned_at;
    const app = applications.find((a) => a.student_id === row.student_id && a.sales_id === row.sales_id);
    const docsDoneAt = app?.created_at;
    if (docsDoneAt && assignedAt) {
      const mins = businessMinutesBetween(assignedAt, docsDoneAt, config);
      if (!docsMinutesBySales.has(row.sales_id)) docsMinutesBySales.set(row.sales_id, []);
      docsMinutesBySales.get(row.sales_id).push(mins);
      const bucket = salesById.get(row.sales_id);
      if (bucket) bucket.documentsValidated += 1;
    } else if (row.dossier_stage === "DOCUMENTS" && assignedAt) {
      const mins = businessMinutesBetween(assignedAt, now, config);
      if (mins >= config.halfwayMinutes) {
        halfwayBySales.set(row.sales_id, (halfwayBySales.get(row.sales_id) || 0) + 1);
      }
    }
  }

  const weekMap = Object.fromEntries(weekCounts.map((r) => [r.sales_id, r.count]));
  const monthMap = Object.fromEntries(monthCounts.map((r) => [r.sales_id, r.count]));
  const replyBySales = new Map();
  for (const pair of replyPairs) {
    if (!pair.assigned_sales_id || !pair.inbound_at || !pair.reply_at) continue;
    const mins = businessMinutesBetween(pair.inbound_at, pair.reply_at, config);
    if (!replyBySales.has(pair.assigned_sales_id)) replyBySales.set(pair.assigned_sales_id, []);
    replyBySales.get(pair.assigned_sales_id).push(mins);
  }

  const sales = [...salesById.values()].map((bucket) => {
    const docsAvg = average(docsMinutesBySales.get(bucket.id) || []);
    const waAvg = average(replyBySales.get(bucket.id) || []);
    return {
      ...bucket,
      avgAssignToDocsMinutes: docsAvg,
      avgAssignToDocsLabel: docsAvg ? formatMinutes(docsAvg) : "—",
      halfwayDossiers: halfwayBySales.get(bucket.id) || 0,
      whatsappConversationsWeek: weekMap[bucket.id] || 0,
      whatsappConversationsMonth: monthMap[bucket.id] || 0,
      avgWhatsappReplyMinutes: waAvg,
      avgWhatsappReplyLabel: waAvg ? formatMinutes(waAvg) : "—"
    };
  });

  const rdvById = new Map();
  const applyMins = new Map();
  const acceptMins = new Map();
  const visaMins = new Map();
  const halfwayRdv = new Map();

  function ensureRdv(row) {
    if (!row.assigned_rdv_id) return null;
    if (!rdvById.has(row.assigned_rdv_id)) {
      rdvById.set(row.assigned_rdv_id, staffDto(row.assigned_rdv_id, row.rdv_prenom, row.rdv_nom, row.rdv_email, {
        isActive: row.rdv_active !== false,
        dossiers: 0,
        avgReadyToAppliedMinutes: 0,
        avgReadyToAppliedLabel: "—",
        avgAppliedToAcceptedMinutes: 0,
        avgAppliedToAcceptedLabel: "—",
        avgVisaPrepToSubmitMinutes: 0,
        avgVisaPrepToSubmitLabel: "—",
        halfwayDossiers: 0
      }));
    }
    return rdvById.get(row.assigned_rdv_id);
  }

  for (const app of applications) {
    const bucket = ensureRdv(app);
    if (!bucket) continue;
    bucket.dossiers += 1;
    if (app.created_at && app.applied_at) {
      const mins = businessMinutesBetween(app.created_at, app.applied_at, config);
      if (!applyMins.has(app.assigned_rdv_id)) applyMins.set(app.assigned_rdv_id, []);
      applyMins.get(app.assigned_rdv_id).push(mins);
    } else if (app.status === "READY_TO_APPLY" && app.created_at) {
      if (businessMinutesBetween(app.created_at, now, config) >= config.halfwayMinutes) {
        halfwayRdv.set(app.assigned_rdv_id, (halfwayRdv.get(app.assigned_rdv_id) || 0) + 1);
      }
    }
    if (app.applied_at && app.decision_at && app.status === "ACCEPTED") {
      const mins = businessMinutesBetween(app.applied_at, app.decision_at, config);
      if (!acceptMins.has(app.assigned_rdv_id)) acceptMins.set(app.assigned_rdv_id, []);
      acceptMins.get(app.assigned_rdv_id).push(mins);
    }
    if (app.visa_docs_validated_at && app.visa_submitted_at) {
      const mins = businessMinutesBetween(app.visa_docs_validated_at, app.visa_submitted_at, config);
      if (!visaMins.has(app.assigned_rdv_id)) visaMins.set(app.assigned_rdv_id, []);
      visaMins.get(app.assigned_rdv_id).push(mins);
    } else if (app.visa_status === "PREPARATION" && app.visa_docs_validated_at) {
      if (businessMinutesBetween(app.visa_docs_validated_at, now, config) >= config.halfwayMinutes) {
        halfwayRdv.set(app.assigned_rdv_id, (halfwayRdv.get(app.assigned_rdv_id) || 0) + 1);
      }
    }
  }

  const rdv = [...rdvById.values()].map((bucket) => {
    const a = average(applyMins.get(bucket.id) || []);
    const b = average(acceptMins.get(bucket.id) || []);
    const c = average(visaMins.get(bucket.id) || []);
    return {
      ...bucket,
      avgReadyToAppliedMinutes: a,
      avgReadyToAppliedLabel: a ? formatMinutes(a) : "—",
      avgAppliedToAcceptedMinutes: b,
      avgAppliedToAcceptedLabel: b ? formatMinutes(b) : "—",
      avgVisaPrepToSubmitMinutes: c,
      avgVisaPrepToSubmitLabel: c ? formatMinutes(c) : "—",
      halfwayDossiers: halfwayRdv.get(bucket.id) || 0
    };
  });

  return {
    workHours: {
      days: config.days,
      start: `${String(config.start.h).padStart(2, "0")}:${String(config.start.m).padStart(2, "0")}`,
      end: `${String(Math.floor(config.endMin / 60)).padStart(2, "0")}:${String(config.endMin % 60).padStart(2, "0")}`,
      timezone: config.timezone,
      halfwayMinutes: config.halfwayMinutes
    },
    sales,
    rdv
  };
}

module.exports = { getWorkHoursReport };
