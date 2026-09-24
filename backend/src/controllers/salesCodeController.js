const salesCodeService = require("../services/salesCodeService");

async function list(req, res) {
  try {
    const codes = await salesCodeService.listForSales(req.auth.sub);
    res.json(codes);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function create(req, res) {
  try {
    const code = await salesCodeService.createCode(req.auth.sub, req.body);
    res.status(201).json(code);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

module.exports = {
  list,
  create
};
