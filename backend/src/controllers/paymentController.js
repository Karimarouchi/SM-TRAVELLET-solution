const paymentService = require("../services/paymentService");

function handle(res, error, fallback = 500) {
  res.status(error.status || fallback).json({ error: error.message || "Erreur serveur." });
}

async function stats(_req, res) {
  try {
    res.json(await paymentService.stats());
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function overview(_req, res) {
  try {
    res.json(await paymentService.overview());
  } catch (error) {
    handle(res, error);
  }
}

async function listPlans(req, res) {
  try {
    res.json(await paymentService.listPlans(req.query || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function listJournal(req, res) {
  try {
    res.json(await paymentService.listJournal(req.query || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function listPricing(_req, res) {
  try {
    res.json(await paymentService.listPricing());
  } catch (error) {
    handle(res, error);
  }
}

async function getPricing(req, res) {
  try {
    res.json(await paymentService.getPricingForCountry(req.params.countryId));
  } catch (error) {
    handle(res, error);
  }
}

async function setPricing(req, res) {
  try {
    res.json(await paymentService.setPricing(req.auth, req.params.countryId, req.body || {}));
  } catch (error) {
    handle(res, error, 400);
  }
}

async function removePricing(req, res) {
  try {
    res.json(await paymentService.removePricing(req.params.countryId));
  } catch (error) {
    handle(res, error, 400);
  }
}

async function studentSummary(req, res) {
  try {
    res.json(await paymentService.summaryForStudent(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function mySummary(req, res) {
  try {
    res.json(await paymentService.summaryForStudent(req.auth, req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function record(req, res) {
  try {
    res.status(201).json(await paymentService.recordPayment(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error, 400);
  }
}

async function cancel(req, res) {
  try {
    res.json(await paymentService.cancelPayment(req.auth, req.params.id, req.body?.reason));
  } catch (error) {
    handle(res, error, 400);
  }
}

module.exports = { stats, overview, listPlans, listJournal, listPricing, getPricing, setPricing, removePricing, studentSummary, mySummary, record, cancel };
