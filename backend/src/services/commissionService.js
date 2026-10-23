const commissionRepo = require("../repositories/commissionRepository");
const countryRepo = require("../repositories/countryRepository");
const userRepo = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const logger = require("../logger");

const ROLES = ["SALES", "RDV"];
const STAGES = ["CODE_CLAIMED", "DOCUMENTS_VALIDATED", "APPLIED", "ACCEPTED", "VISA_DOCUMENTS_VALIDATED", "VISA_SUBMITTED", "VISA_ACCEPTED"];
const STAGE_LABELS = {
  CODE_CLAIMED: "Code conseiller utilisé",
  DOCUMENTS_VALIDATED: "Documents validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Acceptation université",
  VISA_DOCUMENTS_VALIDATED: "Documents visa validés",
  VISA_SUBMITTED: "Dossier visa déposé",
  VISA_ACCEPTED: "Visa obtenu"
};

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function ruleDto(row) {
  return {
    id: row.id,
    countryId: row.country_id,
    countryName: row.country_name,
    role: row.role,
    stage: row.stage,
    amountDinar: Number(row.amount_dinar),
    active: row.active
  };
}

function earningDto(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_prenom ? `${row.user_prenom} ${row.user_nom}`.trim() : undefined,
    userEmail: row.user_email,
    studentId: row.student_id,
    studentName: row.student_prenom ? `${row.student_prenom} ${row.student_nom}`.trim() : undefined,
    applicationId: row.application_id,
    countryId: row.country_id,
    countryName: row.country_name,
    role: row.role,
    stage: row.stage,
    amountDinar: Number(row.amount_dinar),
    earnedAt: row.earned_at,
    paidAt: row.paid_at || null,
    payoutNumber: row.payout_number || null
  };
}

async function listRules() {
  const rows = await commissionRepo.listRules();
  return rows.map(ruleDto);
}

async function upsertRule(payload) {
  if (!payload.countryId) throw fail("Le pays est obligatoire.", 400);
  if (!ROLES.includes(payload.role)) throw fail("Rôle invalide (SALES ou RDV).", 400);
  if (!STAGES.includes(payload.stage)) throw fail("Étape invalide.", 400);
  const amount = Number(payload.amountDinar);
  if (!Number.isFinite(amount) || amount < 0) throw fail("Le montant doit être un nombre positif.", 400);

  const country = await countryRepo.findById(payload.countryId);
  if (!country) throw fail("Pays introuvable.", 404);

  const row = await commissionRepo.upsertRule({
    countryId: payload.countryId,
    role: payload.role,
    stage: payload.stage,
    amountDinar: amount
  });
  return ruleDto({ ...row, country_name: country.name });
}

async function setRuleActive(id, active) {
  const row = await commissionRepo.setRuleActive(id, Boolean(active));
  if (!row) throw fail("Règle introuvable.", 404);
  return ruleDto(row);
}

async function removeRule(id) {
  const removed = await commissionRepo.removeRule(id);
  if (!removed) throw fail("Règle introuvable.", 404);
  return { success: true, id };
}

async function listAllEarnings() {
  const rows = await commissionRepo.listAllEarnings();
  return rows.map(earningDto);
}

async function listEarningsForUser(userId) {
  const rows = await commissionRepo.listEarningsForUser(userId);
  const earnings = rows.map(earningDto);
  const total = earnings.reduce((sum, e) => sum + e.amountDinar, 0);
  const paidTotal = earnings.filter((e) => e.paidAt).reduce((sum, e) => sum + e.amountDinar, 0);
  return { earnings, total, paidTotal, dueTotal: total - paidTotal };
}

// Point d'entrée unique utilisé par tous les déclencheurs métier. Ne bloque
// jamais l'action en cours si quelque chose échoue ici — la commission est
// un à-côté, pas une condition de la logique principale.
async function awardCommission({ userId, studentId, countryId, role, stage, applicationId }) {
  if (!userId || !studentId || !countryId) return;
  try {
    const rule = await commissionRepo.findActiveRule(countryId, role, stage);
    if (!rule || Number(rule.amount_dinar) <= 0) return;
    const earning = await commissionRepo.recordEarning({
      ruleId: rule.id,
      userId,
      studentId,
      applicationId,
      countryId,
      role,
      stage,
      amountDinar: rule.amount_dinar
    });
    if (earning) {
      logger.info("Commission attribuée", { userId, studentId, countryId, role, stage, amount: rule.amount_dinar });
      const student = await userRepo.findById(studentId);
      await notificationService.notify(userId, {
        type: "COMMISSION_EARNED",
        title: `Commission gagnée : ${Number(rule.amount_dinar)} DT`,
        body: `${STAGE_LABELS[stage] || stage}${student ? ` — ${student.prenom} ${student.nom}` : ""}.`,
        link: role === "RDV" ? (stage.startsWith("VISA") ? "/rdv/visas" : "/rdv") : "/conseiller"
      });
    }
  } catch (err) {
    logger.error("Échec de l'attribution d'une commission", { message: err.message, userId, studentId, countryId, role, stage });
  }
}

// La candidature disparaît : les commissions gagnées grâce à elle
// (dépôt, acceptation, visa) sont retirées pour le conseiller et le
// Responsable Dossier. Pas de notification. Une commission déjà versée reste.
// « Documents validés » et « code utilisé » restent : les documents restent.
async function voidForRemovedApplication(application, otherApplications) {
  const others = (otherApplications || []).filter((row) => row.country_id === application.country_id);
  const stillJustified = {
    APPLIED: others.some((row) => row.applied_at),
    ACCEPTED: others.some((row) => row.status === "ACCEPTED" || row.visa_status),
    VISA_DOCUMENTS_VALIDATED: others.some((row) => row.visa_docs_validated_at),
    VISA_SUBMITTED: others.some((row) => row.visa_status === "SUBMITTED" || row.visa_status === "ACCEPTED"),
    VISA_ACCEPTED: others.some((row) => row.visa_status === "ACCEPTED")
  };
  const earnings = await commissionRepo.listForStudentCountry(application.student_id, application.country_id);
  const removed = [];
  for (const earning of earnings) {
    if (earning.stage === "CODE_CLAIMED" || earning.stage === "DOCUMENTS_VALIDATED") continue;
    if (!Object.prototype.hasOwnProperty.call(stillJustified, earning.stage)) continue;
    if (earning.application_id && earning.application_id !== application.id && stillJustified[earning.stage]) continue;
    if (stillJustified[earning.stage]) {
      if (earning.application_id === application.id) {
        const keeper = others.find((row) => {
          if (earning.stage === "APPLIED") return row.applied_at;
          if (earning.stage === "ACCEPTED") return row.status === "ACCEPTED" || row.visa_status;
          if (earning.stage === "VISA_DOCUMENTS_VALIDATED") return row.visa_docs_validated_at;
          if (earning.stage === "VISA_SUBMITTED") return row.visa_status === "SUBMITTED" || row.visa_status === "ACCEPTED";
          return row.visa_status === "ACCEPTED";
        });
        if (keeper) await commissionRepo.retargetApplication(earning.id, keeper.id);
      }
      continue;
    }
    if (earning.application_id && earning.application_id !== application.id) continue;
    const gone = await commissionRepo.removeEarning(earning.id);
    if (gone) removed.push(gone);
  }
  if (removed.length) {
    logger.info("Commissions retirées avec la candidature", {
      applicationId: application.id,
      lines: removed.map((row) => ({ role: row.role, stage: row.stage, amount: row.amount_dinar }))
    });
  }
  return removed;
}

module.exports = {
  ROLES,
  STAGES,
  listRules,
  upsertRule,
  setRuleActive,
  removeRule,
  listAllEarnings,
  listEarningsForUser,
  awardCommission,
  voidForRemovedApplication
};
