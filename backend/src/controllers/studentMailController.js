const service = require("../services/studentMailService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function listMine(req, res) {
  try {
    res.json(await service.listMine(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function unreadMine(req, res) {
  try {
    res.json(await service.unreadMine(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function markRead(req, res) {
  try {
    res.json(await service.markRead(req.auth.sub, req.params.mailId));
  } catch (error) {
    handle(res, error);
  }
}

async function listForStaff(req, res) {
  try {
    res.json(await service.listForStaff(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { listMine, unreadMine, markRead, listForStaff };
