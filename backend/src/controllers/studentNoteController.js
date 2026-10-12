const service = require("../services/studentNoteService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function list(req, res) {
  try {
    res.json(await service.list(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function create(req, res) {
  try {
    res.status(201).json(await service.create(req.auth, req.params.id, req.body?.body));
  } catch (error) {
    handle(res, error);
  }
}

async function remove(req, res) {
  try {
    res.json(await service.remove(req.auth, req.params.noteId));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { list, create, remove };
