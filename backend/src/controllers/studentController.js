const studentService = require("../services/studentService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function me(req, res) {
  try {
    res.json(await studentService.getMine(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function onboarding(req, res) {
  try {
    res.json(await studentService.saveOnboarding(req.auth.sub, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function identity(req, res) {
  try {
    res.json(await studentService.updateIdentity(req.auth.sub, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function avatar(req, res) {
  try {
    res.json(await studentService.saveAvatar(req.auth.sub, req.body.image));
  } catch (error) {
    handle(res, error);
  }
}

async function blockers(req, res) {
  try {
    await studentService.assertCanView(req.auth, req.params.id);
    res.json(await require("../services/applicationBlockersService").reasonsFor(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function detail(req, res) {
  try {
    res.json(await studentService.getDetail(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function list(req, res) {
  try {
    res.json(await studentService.listStudents(req.auth, req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function assign(req, res) {
  try {
    res.json(await studentService.assignSales(req.auth, req.params.id, req.body.salesId));
  } catch (error) {
    handle(res, error);
  }
}

async function destination(req, res) {
  try {
    res.json(await studentService.setStudyDestination(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { me, detail, onboarding, identity, avatar, list, assign, blockers, destination };
