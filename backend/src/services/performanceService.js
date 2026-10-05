const settings = require("../repositories/settingsRepository");
const performanceRepo = require("../repositories/performanceRepository");
const { parseWorkHours, businessMinutesBetween, formatMinutes } = require("./businessHours");

// Statistiques Admin (Dashboard + page d'un employé). Toutes les durées sont
// en heures ouvrées (jours et plages définis dans Paramètres).

const PERIODS = { "7": 7, "30": 30, "90": 90, all: null };

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function periodStart(period) {
  const key = Object.prototype.hasOwnProperty.call(PERIODS, String(period)) ? String(period) : "30";
  const days = PERIODS[key];
  return { key, since: days ? new Date(Date.now() - days * 86400000) : null };
}

function inPeriod(date, since) {
  return Boolean(date) && (!since || new Date(date) >= since);
}

// Durée moyenne + nombre de mesures (0 min est une vraie valeur : réponse
// envoyée hors horaires ouvrés).
function duration(values) {
  if (!values.length) return { minutes: null, label: "—", count: 0 };
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { minutes: Math.round(avg), label: formatMinutes(avg), count: values.length };
}

function rate(part, total) {
  return total ? Math.round((part / total) * 100) : null;
}

function push(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function fullName(prenom, nom) {
  return `${prenom || ""} ${nom || ""}`.trim();
}

function contactLabel(c) {
  return fullName(c.student_prenom, c.student_nom) || c.profile_name || `+${c.phone}`;
}

// Découpe chaque conversation en « tours » : du premier message de l'étudiant
// resté sans réponse jusqu'à la première réponse. Plusieurs messages d'affilée
// de l'étudiant = un seul tour (sinon ils fausseraient la moyenne).
function buildTurns(messages) {
  const turns = [];
  let open = null;
  let currentContact = null;
  let firstTurnDone = false;
  for (const m of messages) {
    if (m.contact_id !== currentContact) {
      if (open) turns.push(open);
      open = null;
      currentContact = m.contact_id;
      firstTurnDone = false;
    }
    if (m.direction === "in") {
      if (!open) open = { contactId: m.contact_id, startedAt: m.created_at, repliedAt: null, repliedBy: null, first: !firstTurnDone };
    } else if (open) {
      open.repliedAt = m.created_at;
      open.repliedBy = m.sent_by;
      turns.push(open);
      open = null;
      firstTurnDone = true;
    } else {
      firstTurnDone = true;
    }
  }
  if (open) turns.push(open);
  return turns;
}

// Entonnoir WhatsApp : une conversation est « aboutie » si le conseiller a
// parlé avec le contact ET qu'un code lui a été envoyé ou qu'il s'est inscrit.
function whatsappFunnel(conversations) {
  const answered = conversations.filter((c) => c.answered);
  const converted = answered.filter((c) => c.code_sent || c.student_id);
  return {
    conversations: conversations.length,
    answered: answered.length,
    unanswered: conversations.length - answered.length,
    codeSent: answered.filter((c) => c.code_sent).length,
    registered: answered.filter((c) => c.student_id).length,
    converted: converted.length,
    notConverted: answered.length - converted.length,
    conversionRate: rate(converted.length, answered.length)
  };
}

async function computeReport(period) {
  const config = parseWorkHours(await settings.getWorkHoursConfig());
  const { key, since } = periodStart(period);
  const now = new Date();
  const minutes = (from, to) => businessMinutesBetween(from, to, config);

  const [staffRows, conversationRows, messages, students, reviews, applications, codes] = await Promise.all([
    performanceRepo.listStaff(),
    performanceRepo.listConversations(),
    performanceRepo.listMessagesForTurns(since),
    performanceRepo.listSalesStudents(),
    performanceRepo.listDocumentReviews(since),
    performanceRepo.listApplications(),
    performanceRepo.listCodes()
  ]);

  // ── WhatsApp ───────────────────────────────────────────────────────────
  // Conversations de la période = celles où le contact a écrit pendant la période.
  const periodConversations = conversationRows.filter((c) => inPeriod(c.last_inbound_at, since));
  const conversationById = new Map(conversationRows.map((c) => [c.id, c]));
  const turns = buildTurns(messages);
  const firstReply = new Map();
  const reply = new Map();
  const teamFirstReply = [];
  const teamReply = [];
  const pendingByOwner = new Map();
  const pendingAll = [];
  let teamPending = 0;
  for (const turn of turns) {
    const conversation = conversationById.get(turn.contactId);
    if (!turn.repliedAt) {
      // En attente de réponse maintenant (quelle que soit la période).
      const waiting = minutes(turn.startedAt, now);
      teamPending += 1;
      pendingAll.push({
        contactId: turn.contactId,
        name: conversation ? contactLabel(conversation) : "",
        phone: conversation?.phone || "",
        ownerId: conversation?.owner_id || null,
        // Messagerie où ouvrir la conversation : inscrits (liée à un compte) ou non inscrits.
        segment: conversation?.student_id ? "inscrits" : "prospects",
        since: new Date(turn.startedAt).toISOString(),
        waitingLabel: formatMinutes(waiting),
        waitingMinutes: waiting
      });
      push(pendingByOwner, conversation?.owner_id, {
        contactId: turn.contactId,
        name: conversation ? contactLabel(conversation) : "",
        phone: conversation?.phone || "",
        since: new Date(turn.startedAt).toISOString(),
        waitingLabel: formatMinutes(waiting),
        waitingMinutes: waiting
      });
      continue;
    }
    if (!inPeriod(turn.startedAt, since)) continue;
    const value = minutes(turn.startedAt, turn.repliedAt);
    teamReply.push(value);
    push(reply, turn.repliedBy, value);
    if (turn.first) {
      teamFirstReply.push(value);
      push(firstReply, turn.repliedBy, value);
    }
  }

  // ── Dossiers suivis par les conseillers ────────────────────────────────
  const handoff = new Map();
  const halfwaySales = new Map();
  const studentsBySales = new Map();
  for (const s of students) {
    push(studentsBySales, s.sales_id, s);
    if (s.handed_off_at) {
      if (inPeriod(s.handed_off_at, since)) push(handoff, s.sales_id, minutes(s.started_at, s.handed_off_at));
    } else if (s.dossier_stage === "DOCUMENTS" && s.started_at) {
      const waited = minutes(s.started_at, now);
      if (waited >= config.halfwayMinutes) {
        push(halfwaySales, s.sales_id, {
          name: fullName(s.prenom, s.nom),
          step: "Documents du dossier",
          waitingLabel: formatMinutes(waited),
          waitingMinutes: waited
        });
      }
    }
  }

  const reviewTimes = new Map();
  const reviewCounts = new Map();
  for (const r of reviews) {
    push(reviewTimes, r.reviewed_by, minutes(r.submitted_at, r.reviewed_at));
    const counts = reviewCounts.get(r.reviewed_by) || { validated: 0, rejected: 0 };
    if (r.status === "VALIDATED") counts.validated += 1;
    if (r.status === "REJECTED") counts.rejected += 1;
    reviewCounts.set(r.reviewed_by, counts);
  }

  // ── Candidatures et visa ───────────────────────────────────────────────
  const acceptedToVisaDocs = new Map();
  const readyToApplied = new Map();
  const appliedToDecision = new Map();
  const visaDocsToSubmit = new Map();
  const rdvOutcomes = new Map();
  const halfwayRdv = new Map();
  const dossiersByRdv = new Map();
  for (const a of applications) {
    const student = fullName(a.student_prenom, a.student_nom);
    if (a.status === "ACCEPTED" && a.decision_at && a.visa_docs_validated_at && inPeriod(a.visa_docs_validated_at, since)) {
      push(acceptedToVisaDocs, a.sales_id, minutes(a.decision_at, a.visa_docs_validated_at));
    }
    if (!a.assigned_rdv_id) continue;
    if (a.status !== "CLOSED") push(dossiersByRdv, a.assigned_rdv_id, a);
    if (a.applied_at && inPeriod(a.applied_at, since)) push(readyToApplied, a.assigned_rdv_id, minutes(a.created_at, a.applied_at));
    if (a.applied_at && a.decision_at && ["ACCEPTED", "REJECTED"].includes(a.status) && inPeriod(a.decision_at, since)) {
      push(appliedToDecision, a.assigned_rdv_id, minutes(a.applied_at, a.decision_at));
    }
    if (a.visa_docs_validated_at && a.visa_submitted_at && inPeriod(a.visa_submitted_at, since)) {
      push(visaDocsToSubmit, a.assigned_rdv_id, minutes(a.visa_docs_validated_at, a.visa_submitted_at));
    }
    const outcome = rdvOutcomes.get(a.assigned_rdv_id) || { accepted: 0, rejected: 0, visaAccepted: 0, visaRejected: 0 };
    if (inPeriod(a.decision_at, since)) {
      if (a.status === "ACCEPTED") outcome.accepted += 1;
      if (a.status === "REJECTED") outcome.rejected += 1;
    }
    if (inPeriod(a.visa_decision_at, since)) {
      if (a.visa_status === "ACCEPTED") outcome.visaAccepted += 1;
      if (a.visa_status === "REJECTED") outcome.visaRejected += 1;
    }
    rdvOutcomes.set(a.assigned_rdv_id, outcome);

    // Dossiers qui n'avancent pas côté RDV.
    const stuckFrom = a.status === "READY_TO_APPLY" ? a.created_at
      : a.visa_status === "PREPARATION" && a.visa_docs_validated_at ? a.visa_docs_validated_at
        : null;
    if (stuckFrom) {
      const waited = minutes(stuckFrom, now);
      if (waited >= config.halfwayMinutes) {
        push(halfwayRdv, a.assigned_rdv_id, {
          name: student,
          step: a.status === "READY_TO_APPLY" ? `Candidature à déposer · ${a.country_name || ""}` : `Visa à déposer · ${a.country_name || ""}`,
          waitingLabel: formatMinutes(waited),
          waitingMinutes: waited
        });
      }
    }
  }

  const codesBySales = new Map();
  for (const c of codes) {
    const bucket = codesBySales.get(c.sales_id) || { created: 0, used: 0, sentOnWhatsapp: 0 };
    if (inPeriod(c.created_at, since)) {
      bucket.created += 1;
      if (c.whatsapp_contact_id) bucket.sentOnWhatsapp += 1;
    }
    if (c.used && inPeriod(c.used_at, since)) bucket.used += 1;
    codesBySales.set(c.sales_id, bucket);
  }

  // ── Assemblage par employé ─────────────────────────────────────────────
  const byWaiting = (list) => (list || []).sort((a, b) => b.waitingMinutes - a.waitingMinutes);
  const staff = staffRows.map((u) => {
    const roles = Array.from(new Set([u.role, ...(u.extra_roles || [])]));
    const base = {
      id: u.id,
      prenom: u.prenom || "",
      nom: u.nom || "",
      email: u.email || "",
      phone: u.phone || "",
      isActive: u.is_active !== false,
      roles
    };
    let sales = null;
    if (roles.includes("SALES")) {
      const mine = periodConversations.filter((c) => c.owner_id === u.id);
      const counts = reviewCounts.get(u.id) || { validated: 0, rejected: 0 };
      sales = {
        whatsapp: {
          ...whatsappFunnel(mine),
          firstReply: duration(firstReply.get(u.id) || []),
          reply: duration(reply.get(u.id) || []),
          pendingNow: (pendingByOwner.get(u.id) || []).length
        },
        students: (studentsBySales.get(u.id) || []).length,
        handoff: duration(handoff.get(u.id) || []),
        documentReview: duration(reviewTimes.get(u.id) || []),
        documentsValidated: counts.validated,
        documentsRejected: counts.rejected,
        acceptedToVisaDocs: duration(acceptedToVisaDocs.get(u.id) || []),
        halfwayDossiers: (halfwaySales.get(u.id) || []).length,
        codes: codesBySales.get(u.id) || { created: 0, used: 0, sentOnWhatsapp: 0 },
        lists: {
          notConverted: mine
            .filter((c) => c.answered && !c.code_sent && !c.student_id)
            .map((c) => ({ contactId: c.id, name: contactLabel(c), phone: c.phone, lastMessageAt: c.last_message_at })),
          unanswered: mine
            .filter((c) => !c.answered)
            .map((c) => ({ contactId: c.id, name: contactLabel(c), phone: c.phone, lastMessageAt: c.last_message_at })),
          pending: byWaiting(pendingByOwner.get(u.id)),
          halfway: byWaiting(halfwaySales.get(u.id))
        }
      };
    }
    let rdv = null;
    if (roles.includes("RDV")) {
      const outcome = rdvOutcomes.get(u.id) || { accepted: 0, rejected: 0, visaAccepted: 0, visaRejected: 0 };
      rdv = {
        dossiers: (dossiersByRdv.get(u.id) || []).length,
        readyToApplied: duration(readyToApplied.get(u.id) || []),
        appliedToDecision: duration(appliedToDecision.get(u.id) || []),
        visaDocsToSubmit: duration(visaDocsToSubmit.get(u.id) || []),
        ...outcome,
        acceptanceRate: rate(outcome.accepted, outcome.accepted + outcome.rejected),
        visaAcceptanceRate: rate(outcome.visaAccepted, outcome.visaAccepted + outcome.visaRejected),
        halfwayDossiers: (halfwayRdv.get(u.id) || []).length,
        lists: { halfway: byWaiting(halfwayRdv.get(u.id)) }
      };
    }
    return { ...base, sales, rdv };
  });

  const staffById = new Map(staffRows.map((u) => [u.id, u]));
  return {
    period: key,
    workHours: {
      days: config.days,
      start: `${String(config.start.h).padStart(2, "0")}:${String(config.start.m).padStart(2, "0")}`,
      end: `${String(Math.floor(config.endMin / 60)).padStart(2, "0")}:${String(config.endMin % 60).padStart(2, "0")}`,
      timezone: config.timezone,
      halfwayMinutes: config.halfwayMinutes
    },
    whatsapp: {
      ...whatsappFunnel(periodConversations),
      unassigned: periodConversations.filter((c) => !c.owner_id).length,
      firstReply: duration(teamFirstReply),
      reply: duration(teamReply),
      pendingNow: teamPending,
      // Conversations à traiter, les plus anciennes d'abord, avec leur conseiller.
      pending: pendingAll
        .map((item) => ({ ...item, ownerName: item.ownerId ? fullName(staffById.get(item.ownerId)?.prenom, staffById.get(item.ownerId)?.nom) || "Conseiller" : "" }))
        .sort((a, b) => b.waitingMinutes - a.waitingMinutes)
    },
    staff
  };
}

// Dashboard : l'équipe entière, sans les listes détaillées.
async function getTeamPerformance(period) {
  const report = await computeReport(period);
  return {
    ...report,
    staff: report.staff.map((s) => ({
      ...s,
      sales: s.sales ? { ...s.sales, lists: undefined } : null,
      rdv: s.rdv ? { ...s.rdv, lists: undefined } : null
    }))
  };
}

// Page d'un employé : tout le détail, listes comprises.
async function getUserPerformance(userId, period) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId))) throw fail("Employé introuvable.", 404);
  const report = await computeReport(period);
  const user = report.staff.find((s) => s.id === userId);
  if (!user) throw fail("Employé introuvable (ni conseiller ni Responsable Visa).", 404);
  return { period: report.period, workHours: report.workHours, user };
}

module.exports = { getTeamPerformance, getUserPerformance, buildTurns };
