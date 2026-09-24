const programmeService = require("../services/programmeService");

function handle(res, error) {
  res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
}

async function listPublic(_req, res) {
  try {
    const list = await programmeService.listAll();
    res.json(list);
  } catch (err) {
    handle(res, err);
  }
}

async function listAdmin(_req, res) {
  try {
    const list = await programmeService.listAll();
    res.json(list);
  } catch (err) {
    handle(res, err);
  }
}

async function create(req, res) {
  try {
    const programme = await programmeService.createProgramme(req.body);
    res.status(201).json(programme);
  } catch (err) {
    handle(res, err);
  }
}

async function update(req, res) {
  try {
    const programme = await programmeService.updateProgramme(req.params.id, req.body);
    res.json(programme);
  } catch (err) {
    handle(res, err);
  }
}

async function remove(req, res) {
  try {
    const result = await programmeService.removeProgramme(req.params.id);
    res.json(result);
  } catch (err) {
    handle(res, err);
  }
}

async function uploadImage(req, res) {
  try {
    const imageUrl = await programmeService.saveImage(req.body.image);
    res.json({ imageUrl });
  } catch (err) {
    handle(res, err);
  }
}

module.exports = {
  listPublic,
  listAdmin,
  create,
  update,
  remove,
  uploadImage
};
