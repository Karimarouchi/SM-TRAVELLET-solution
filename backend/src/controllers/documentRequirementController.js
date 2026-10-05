const documentService = require("../services/documentRequirementService");

async function listByCountry(req, res) {
  try {
    const documents = await documentService.listByCountry(req.params.countryId);
    res.json(documents);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function listByUniversity(req, res) {
  try {
    res.json(await documentService.listByUniversity(req.auth, req.params.id));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function createForUniversity(req, res) {
  try {
    res.status(201).json(await documentService.createForUniversity(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function create(req, res) {
  try {
    const document = await documentService.createDocument(req.auth, req.params.countryId, req.body);
    res.status(201).json(document);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function update(req, res) {
  try {
    const document = await documentService.updateDocument(req.auth, req.params.id, req.body);
    res.json(document);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function setActive(req, res) {
  try {
    const document = await documentService.setActive(req.auth, req.params.id, req.body.active);
    res.json(document);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function remove(req, res) {
  try {
    const result = await documentService.removeDocument(req.auth, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

module.exports = {
  listByUniversity,
  createForUniversity,
  listByCountry,
  create,
  update,
  setActive,
  remove
};
