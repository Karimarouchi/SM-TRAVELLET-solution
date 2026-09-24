const appRepo = require("../repositories/universityApplicationRepository");
const settingsRepo = require("../repositories/settingsRepository");
const archiveService = require("../services/archiveService");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function listArchive(req, res, next) {
  try {
    const auth = req.auth;
    const filters = {
      salesId: req.query.salesId || null,
      countryId: req.query.countryId || null,
      search: req.query.search || null
    };
    const entries = await appRepo.listArchived(auth, filters);

    const data = entries.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: `${row.student_prenom} ${row.student_nom}`,
      studentEmail: row.student_email,
      studentNationality: row.nationality || null,
      studentResidenceCountry: row.residence_country || null,
      studentPhone: row.student_phone || null,
      studentAvatarUrl: row.student_avatar_url || null,
      countryId: row.country_id,
      countryName: row.country_name,
      universityId: row.university_id,
      universityName: row.university_name,
      salesId: row.sales_id,
      salesName: row.sales_id ? `${row.sales_prenom} ${row.sales_nom}` : null,
      rdvId: row.assigned_rdv_id,
      rdvName: row.assigned_rdv_id ? `${row.rdv_prenom} ${row.rdv_nom}` : null,
      status: row.status,
      visaStatus: row.visa_status || null,
      dossierStage: row.dossier_stage || null,
      appliedAt: row.applied_at,
      decisionAt: row.decision_at,
      updatedAt: row.updated_at
    }));

    res.json({ entries: data, total: data.length });
  } catch (err) {
    next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    const config = await settingsRepo.getArchivePurgeConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { enabled, days } = req.body;
    await settingsRepo.setArchivePurgeConfig(enabled, days);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function purge(req, res, next) {
  try {
    const config = await settingsRepo.getArchivePurgeConfig();
    // Utilise le délai configuré, ou 0 si non défini pour forcer la purge de tout ce qui est archivé.
    const result = await archiveService.runPurge(config.enabled ? config.days : 0);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { listArchive, getSettings, updateSettings, purge };
