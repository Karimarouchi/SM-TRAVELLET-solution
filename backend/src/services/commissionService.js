const commissionRepo = require("../repositories/commissionRepository");
const countryRepo = require("../repositories/countryRepository");
const logger = require("../logger");

const ROLES = ["SALES", "RDV"];
const STAGES = ["CODE_CLAIMED", "DOCUMENTS_VALIDATED", "APPLIED", "ACCEPTED", "VISA_SUBMITTED", "VISA_ACCEPTED"];

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
    earnedAt: row.earned_at
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
  return { earnings, total };
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
    }
  } catch (err) {
    logger.error("Échec de l'attribution d'une commission", { message: err.message, userId, studentId, countryId, role, stage });
  }
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
  awardCommission
};
