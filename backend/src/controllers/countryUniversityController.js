const universityService = require("../services/countryUniversityService");

function handle(res, error) {
  res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
}

async function listByCountry(req, res) {
  try {
    res.json(await universityService.listByCountry(req.params.countryId));
  } catch (error) {
    handle(res, error);
  }
}

async function listPublic(req, res) {
  try {
    const countryIds = String(req.query.countryIds || "").split(",").map((s) => s.trim()).filter(Boolean);
    res.json(await universityService.listActiveForCountryIds(countryIds));
  } catch (error) {
    handle(res, error);
  }
}

async function create(req, res) {
  try {
    const university = await universityService.createUniversity(req.params.countryId, req.body);
    res.status(201).json(university);
  } catch (error) {
    handle(res, error);
  }
}

async function update(req, res) {
  try {
    res.json(await universityService.updateUniversity(req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function setActive(req, res) {
  try {
    res.json(await universityService.setActive(req.params.id, req.body.active));
  } catch (error) {
    handle(res, error);
  }
}

async function remove(req, res) {
  try {
    res.json(await universityService.removeUniversity(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = {
  listByCountry,
  listPublic,
  create,
  update,
  setActive,
  remove
};
