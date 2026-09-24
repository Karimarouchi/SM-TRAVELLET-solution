const commissionService = require("../services/commissionService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function listRules(req, res) {
  try {
    res.json(await commissionService.listRules());
  } catch (error) {
    handle(res, error);
  }
}

async function upsertRule(req, res) {
  try {
    res.json(await commissionService.upsertRule(req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function setRuleActive(req, res) {
  try {
    res.json(await commissionService.setRuleActive(req.params.id, req.body.active));
  } catch (error) {
    handle(res, error);
  }
}

async function removeRule(req, res) {
  try {
    res.json(await commissionService.removeRule(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function listAllEarnings(req, res) {
  try {
    res.json(await commissionService.listAllEarnings());
  } catch (error) {
    handle(res, error);
  }
}

async function myEarnings(req, res) {
  try {
    res.json(await commissionService.listEarningsForUser(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { listRules, upsertRule, setRuleActive, removeRule, listAllEarnings, myEarnings };
