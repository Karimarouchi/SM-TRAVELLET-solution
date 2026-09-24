const crypto = require("crypto");
const salesCodeRepo = require("../repositories/salesCodeRepository");
const countryRepo = require("../repositories/countryRepository");
const studentRepo = require("../repositories/studentRepository");
const commissionService = require("./commissionService");

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans caractères ambigus (0/O, 1/I)

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function randomSuffix(length = 6) {
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function codeDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    countryId: row.country_id,
    countryName: row.country_name || null,
    prefillCurrentStudyLevel: row.prefill_current_study_level,
    prefillTargetLevel: row.prefill_target_level,
    prefillPhone: row.prefill_phone,
    used: row.used,
    usedByStudentId: row.used_by_student_id,
    usedByName: row.used_by_prenom ? `${row.used_by_prenom} ${row.used_by_nom || ""}`.trim() : null,
    usedAt: row.used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at
  };
}

async function listForSales(salesId) {
  const rows = await salesCodeRepo.findBySales(salesId);
  return rows.map(codeDto);
}

async function createCode(salesId, payload) {
  if (!payload.countryId) throw fail("Le pays est obligatoire pour générer un code.", 400);
  const country = await countryRepo.findById(payload.countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  if (!country.active) throw fail("Ce pays est désactivé.", 400);

  let expiresAt = null;
  if (payload.expiresAt) {
    const date = new Date(payload.expiresAt);
    if (Number.isNaN(date.getTime())) throw fail("Date d'expiration invalide.", 400);
    expiresAt = date;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `SM-${randomSuffix(6)}`;
    if (await salesCodeRepo.findByCode(code)) continue; // collision, retry
    const row = await salesCodeRepo.create({
      code,
      salesId,
      countryId: country.id,
      prefillCurrentStudyLevel: payload.prefillCurrentStudyLevel ? String(payload.prefillCurrentStudyLevel).trim() : null,
      prefillTargetLevel: payload.prefillTargetLevel ? String(payload.prefillTargetLevel).trim() : null,
      prefillPhone: payload.prefillPhone ? String(payload.prefillPhone).trim() : null,
      expiresAt
    });
    return codeDto({ ...row, country_name: country.name });
  }
  throw fail("Impossible de générer un code unique, réessayez.", 500);
}

// Vérifie qu'un code est utilisable AVANT de créer le compte étudiant, pour
// ne jamais rejeter l'inscription après coup (compte déjà créé).
async function assertCodeUsable(rawCode) {
  if (!rawCode) return;
  const code = String(rawCode).trim().toUpperCase();
  if (!code) return;
  const existing = await salesCodeRepo.findByCode(code);
  if (!existing) throw fail("Code invalide.", 400);
  if (existing.used) throw fail("Ce code a déjà été utilisé.", 400);
  if (existing.expires_at && new Date(existing.expires_at) <= new Date()) throw fail("Ce code a expiré.", 400);
}

// Appelé après création du compte si un salesCode est fourni. Consomme le
// code de façon atomique puis applique pays/pré-remplissage + attribution
// Sales. Le compte étant déjà créé, une éventuelle course (code pris entre
// la vérification et ici) ne fait pas échouer l'inscription : elle se
// contente de ne rien appliquer.
async function applyCodeToNewStudent(userId, rawCode) {
  if (!rawCode) return null;
  const code = String(rawCode).trim().toUpperCase();
  if (!code) return null;

  const claimed = await salesCodeRepo.claim(code, userId);
  if (!claimed) return null;

  const country = claimed.country_id ? await countryRepo.findById(claimed.country_id) : null;
  await studentRepo.applyActivationCode(userId, {
    activationCodeId: claimed.id,
    assignedSalesId: claimed.sales_id,
    preferredCountries: country ? [country.name] : [],
    currentStudyLevel: claimed.prefill_current_study_level,
    targetLevel: claimed.prefill_target_level,
    phone: claimed.prefill_phone
  });

  if (claimed.country_id && claimed.sales_id) {
    await commissionService.awardCommission({
      userId: claimed.sales_id,
      studentId: userId,
      countryId: claimed.country_id,
      role: "SALES",
      stage: "CODE_CLAIMED"
    });
  }

  return claimed;
}

module.exports = {
  listForSales,
  createCode,
  assertCodeUsable,
  applyCodeToNewStudent
};
