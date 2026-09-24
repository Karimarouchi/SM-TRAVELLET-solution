const { query } = require("../../db");

async function findByUserId(userId) {
  const result = await query(
    `SELECT sp.*,
            sc.country_id AS code_country_id,
            c.name AS code_country_name,
            sc.prefill_current_study_level AS code_prefill_current_study_level,
            sc.prefill_target_level AS code_prefill_target_level,
            sc.prefill_phone AS code_prefill_phone
     FROM student_profiles sp
     LEFT JOIN sales_codes sc ON sc.id = sp.activation_code_id
     LEFT JOIN countries c ON c.id = sc.country_id
     WHERE sp.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function ensureProfile(userId) {
  const existing = await findByUserId(userId);
  if (existing) return existing;
  const created = await query(
    `INSERT INTO student_profiles (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  return created.rows[0];
}

async function updateOnboarding(userId, fields) {
  const result = await query(
    `UPDATE student_profiles SET
      phone = $2,
      nationality = $3,
      residence_country = $4,
      city = $5,
      current_study_level = $6,
      last_diploma = $7,
      study_field = $8,
      current_institution = $9,
      diploma_year = $10,
      preferred_countries = $11,
      preferred_city = $12,
      target_level = $13,
      target_field = $14,
      target_intake = $15,
      target_university = $16,
      annual_budget = $17,
      funding_mode = $18,
      language_level = $19,
      language_level_french = $20,
      language_level_english = $21,
      language_test = $22,
      language_test_french = $23,
      language_test_english = $24,
      language_test_french_other = $25,
      language_test_english_other = $26,
      has_passport = $27,
      visa_already_requested = $28,
      available_documents = $29,
      onboarding_completed = TRUE,
      onboarding_completed_at = NOW(),
      updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [
      userId,
      fields.phone,
      fields.nationality,
      fields.residenceCountry,
      fields.city,
      fields.currentStudyLevel,
      fields.lastDiploma,
      fields.studyField,
      fields.currentInstitution || null,
      fields.diplomaYear || null,
      fields.preferredCountries,
      fields.preferredCity || null,
      fields.targetLevel,
      fields.targetField,
      fields.targetIntake,
      fields.targetUniversity || null,
      fields.annualBudget,
      fields.fundingMode,
      fields.languageLevel,
      fields.languageLevelFrench,
      fields.languageLevelEnglish,
      fields.languageTest || null,
      fields.languageTestFrench || null,
      fields.languageTestEnglish || null,
      fields.languageTestFrenchOther || null,
      fields.languageTestEnglishOther || null,
      fields.hasPassport,
      fields.visaAlreadyRequested,
      fields.availableDocuments || null
    ]
  );
  return result.rows[0];
}

async function applyActivationCode(userId, { activationCodeId, assignedSalesId, preferredCountries, currentStudyLevel, targetLevel, phone }) {
  const result = await query(
    `UPDATE student_profiles
     SET activation_code_id = $2,
         assigned_sales_id = $3,
         preferred_countries = $4,
         current_study_level = COALESCE(NULLIF($5, ''), current_study_level),
         target_level = COALESCE(NULLIF($6, ''), target_level),
         phone = COALESCE(NULLIF($7, ''), phone),
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, activationCodeId, assignedSalesId, preferredCountries, currentStudyLevel || "", targetLevel || "", phone || ""]
  );
  return result.rows[0] || null;
}

async function setDossierStage(userId, stage) {
  const result = await query(
    `UPDATE student_profiles SET dossier_stage = $2, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
    [userId, stage]
  );
  return result.rows[0] || null;
}

async function assignSales(studentUserId, salesUserId) {
  const result = await query(
    `UPDATE student_profiles
     SET assigned_sales_id = $2, updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [studentUserId, salesUserId]
  );
  return result.rows[0] || null;
}

// Recherche sur nom/prénom/email — évite de renvoyer toute la liste d'un
// coup dès que le nombre d'étudiants grandit.
function searchClause(search, paramIndex) {
  if (!search) return { clause: "", params: [] };
  return {
    clause: `AND (u.prenom ILIKE $${paramIndex} OR u.nom ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`,
    params: [`%${search}%`]
  };
}

async function listForSales(salesUserId, { page = 1, pageSize = 50, search = "" } = {}) {
  const offset = (page - 1) * pageSize;
  const { clause, params } = searchClause(search, 3);
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, u.date_naissance, u.created_at, u.avatar_url,
            sp.onboarding_completed, sp.assigned_sales_id, sp.residence_country,
            sp.target_field, sp.phone, sp.city, sp.current_study_level, sp.preferred_countries,
            COUNT(*) OVER()::int AS total_count
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id
     WHERE sp.assigned_sales_id = $1 ${clause}
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET ${offset}`,
    [salesUserId, pageSize, ...params]
  );
  return { rows: result.rows, total: result.rows[0]?.total_count ?? 0 };
}

async function listAll({ page = 1, pageSize = 50, search = "" } = {}) {
  const offset = (page - 1) * pageSize;
  const { clause, params } = searchClause(search, 2);
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, u.date_naissance, u.created_at, u.role, u.avatar_url,
            sp.onboarding_completed, sp.onboarding_completed_at, sp.assigned_sales_id,
            sp.residence_country, sp.target_field, sp.phone, sp.city, sp.current_study_level,
            sp.preferred_countries,
            COUNT(*) OVER()::int AS total_count
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'STUDENT' ${clause}
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET ${offset}`,
    [pageSize, ...params]
  );
  return { rows: result.rows, total: result.rows[0]?.total_count ?? 0 };
}

// Vue d'ensemble pour l'admin : un étudiant par ligne avec son statut de
// compte (actif/bloqué) et son étape de dossier, sans pagination — cette
// page est pensée pour un pilotage global (pipeline/tableau/cartes), pas
// pour une liste paginée comme listAll.
async function listAllOverview() {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, u.created_at, u.is_active, u.avatar_url,
            sp.onboarding_completed, sp.onboarding_completed_at, sp.assigned_sales_id,
            sp.dossier_stage, sp.residence_country, sp.target_field, sp.phone, sp.city,
            sp.current_study_level, sp.preferred_countries,
            sal.prenom AS sales_prenom, sal.nom AS sales_nom
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN users sal ON sal.id = sp.assigned_sales_id
     WHERE u.role = 'STUDENT'
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

// Étudiants ayant terminé l'onboarding mais n'ayant encore aucune
// candidature active (statut "Sans candidature" du pipeline admin) — utilisé
// par l'alerte de relance automatique.
async function findStalledNoApplication() {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email, sp.onboarding_completed_at, sp.stalled_alert_last_sent_at,
            sp.assigned_sales_id, sal.prenom AS sales_prenom, sal.nom AS sales_nom, sal.email AS sales_email
     FROM users u
     JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN users sal ON sal.id = sp.assigned_sales_id
     LEFT JOIN university_applications ua ON ua.student_id = u.id AND ua.status != 'CLOSED'
     WHERE u.role = 'STUDENT'
       AND sp.onboarding_completed = TRUE
       AND ua.id IS NULL`
  );
  return result.rows;
}

// Transfère en une fois tous les étudiants d'un conseiller vers un autre —
// utilisé quand on remplace un sales (bloqué juste après) sans laisser ses
// dossiers en cours sans personne pour les suivre.
async function reassignAllFromSales(fromSalesId, toSalesId) {
  const result = await query(
    `UPDATE student_profiles SET assigned_sales_id = $2, updated_at = NOW() WHERE assigned_sales_id = $1`,
    [fromSalesId, toSalesId]
  );
  return result.rowCount;
}

async function markStalledAlertSent(userId) {
  await query(
    `UPDATE student_profiles SET stalled_alert_last_sent_at = NOW() WHERE user_id = $1`,
    [userId]
  );
}

module.exports = {
  ensureProfile,
  findByUserId,
  applyActivationCode,
  setDossierStage,
  updateOnboarding,
  assignSales,
  listForSales,
  listAll,
  listAllOverview,
  findStalledNoApplication,
  markStalledAlertSent,
  reassignAllFromSales
};
