const countryService = require("../services/countryService");

async function listPublic(_req, res) {
  try {
    const countries = await countryService.listActive();
    res.json(countries);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function listAdmin(req, res) {
  try {
    const countries = await countryService.listForRequester(req.auth);
    res.json(countries);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function create(req, res) {
  try {
    const country = await countryService.createCountry(req.body);
    res.status(201).json(country);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function update(req, res) {
  try {
    const country = await countryService.updateCountry(req.params.id, req.body);
    res.json(country);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function setActive(req, res) {
  try {
    const country = await countryService.setActive(req.params.id, req.body.active);
    res.json(country);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

module.exports = {
  listPublic,
  listAdmin,
  create,
  update,
  setActive
};
