const salesService = require("../services/salesService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function me(req, res) {
  try {
    res.json(await salesService.getMine(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function list(req, res) {
  try {
    res.json({ sales: await salesService.listSales(req.auth) });
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { me, list };
