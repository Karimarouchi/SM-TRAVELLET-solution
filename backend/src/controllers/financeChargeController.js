const charges = require("../services/financeChargeService");

function handle(res, error) {
  res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
}

async function exercise(req, res) {
  try {
    res.json(await charges.exercise(req.query.year));
  } catch (error) {
    handle(res, error);
  }
}

async function create(req, res) {
  try {
    res.status(201).json(await charges.create(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function remove(req, res) {
  try {
    res.json(await charges.remove(req.params.id, req.query.year));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { exercise, create, remove };
