const backupService = require("../services/backupService");

function handle(res, error) {
  res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
}

async function status(req, res) {
  try {
    res.json(backupService.getStatus() || { success: null, at: null });
  } catch (error) {
    handle(res, error);
  }
}

async function run(req, res) {
  try {
    res.json(await backupService.runBackup(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function restoreStatus(req, res) {
  try {
    res.json(backupService.getRestoreStatus() || { success: null, at: null });
  } catch (error) {
    handle(res, error);
  }
}

async function restore(req, res) {
  try {
    res.json(await backupService.runRestore(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { status, run, restoreStatus, restore };
