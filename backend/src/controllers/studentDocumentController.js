const studentDocumentService = require("../services/studentDocumentService");

async function list(req, res) {
  try {
    const checklist = await studentDocumentService.getChecklist(req.auth.sub);
    res.json(checklist);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function upload(req, res) {
  try {
    const { name, file, originalFilename } = req.body;
    const doc = await studentDocumentService.uploadDocument(req.auth.sub, name, file, originalFilename);
    res.json(doc);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function listForStudent(req, res) {
  try {
    const checklist = await studentDocumentService.getChecklistFor(req.auth, req.params.id);
    res.json(checklist);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function review(req, res) {
  try {
    const { name, status, reason } = req.body;
    const doc = await studentDocumentService.reviewDocument(req.auth, req.params.id, name, status, reason);
    res.json(doc);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function myVisaChecklist(req, res) {
  try {
    const data = await studentDocumentService.getMyVisaChecklist(req.auth.sub);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function uploadVisa(req, res) {
  try {
    const { requirementId, file, originalFilename } = req.body;
    const doc = await studentDocumentService.uploadVisaDocument(req.auth.sub, requirementId, file, originalFilename);
    res.json(doc);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

async function visaChecklistForApplication(req, res) {
  try {
    const checklist = await studentDocumentService.getVisaChecklistForApplication(req.auth, req.params.id);
    res.json(checklist);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || "Erreur serveur." });
  }
}

async function reviewVisa(req, res) {
  try {
    const { requirementId, status, reason } = req.body;
    const doc = await studentDocumentService.reviewVisaDocument(req.auth, req.params.id, requirementId, status, reason);
    res.json(doc);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
  }
}

module.exports = {
  list,
  upload,
  listForStudent,
  review,
  myVisaChecklist,
  uploadVisa,
  visaChecklistForApplication,
  reviewVisa
};
