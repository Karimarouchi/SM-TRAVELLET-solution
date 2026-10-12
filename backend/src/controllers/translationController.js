const service = require("../services/translationService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

const wrap = (fn, status = 200) => async (req, res) => {
  try {
    res.status(status).json(await fn(req));
  } catch (error) {
    handle(res, error);
  }
};

module.exports = {
  request: wrap((req) => service.request(req.auth, req.params.id, req.body?.name, req.body?.universityId), 201),
  remove: wrap((req) => service.remove(req.auth, req.params.translationId)),
  uploadByStudent: wrap((req) => service.uploadByStudent(req.auth.sub, req.params.translationId, req.body?.file, req.body?.originalFilename)),
  uploadByStaff: wrap((req) => service.uploadByStaff(req.auth, req.params.translationId, req.body?.file, req.body?.originalFilename)),
  review: wrap((req) => service.review(req.auth, req.params.translationId, req.body?.status, req.body?.reason))
};
