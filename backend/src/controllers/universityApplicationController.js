const service = require("../services/universityApplicationService");

function handle(res, error) {
  res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function listForStudent(req, res) {
  try {
    res.json(await service.listForStudent(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function listMine(req, res) {
  try {
    res.json(await service.listForStudent(req.auth, req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function historyForStudent(req, res) {
  try {
    res.json(await service.getHistoryForStudent(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function markApplied(req, res) {
  try {
    res.json(await service.markApplied(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function scheduleInterview(req, res) {
  try {
    res.json(await service.scheduleInterview(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function completeInterview(req, res) {
  try {
    res.json(await service.completeInterview(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function markAccepted(req, res) {
  try {
    res.json(await service.markAccepted(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function markRejected(req, res) {
  try {
    res.json(await service.markRejected(req.auth, req.params.id, req.body.reason));
  } catch (error) {
    handle(res, error);
  }
}

async function closeApplication(req, res) {
  try {
    res.json(await service.closeApplication(req.auth, req.params.id, req.body.comment));
  } catch (error) {
    handle(res, error);
  }
}

async function reapply(req, res) {
  try {
    res.status(201).json(await service.reapply(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function assignRdv(req, res) {
  try {
    res.json(await service.assignRdv(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function suggestRdv(req, res) {
  try {
    res.json(await service.suggestRdv(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function markVisaSubmitted(req, res) {
  try {
    res.json(await service.markVisaSubmitted(req.auth, req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function markVisaAccepted(req, res) {
  try {
    res.json(await service.markVisaAccepted(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function markVisaRejected(req, res) {
  try {
    res.json(await service.markVisaRejected(req.auth, req.params.id, req.body.reason));
  } catch (error) {
    handle(res, error);
  }
}

async function listMineForRdv(req, res) {
  try {
    res.json(await service.listMineForRdv(req.auth));
  } catch (error) {
    handle(res, error);
  }
}

async function scheduleVisaPrepMeeting(req, res) {
  try {
    res.json(await service.scheduleVisaPrepMeeting(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function scheduleVisaEmbassyAppointment(req, res) {
  try {
    res.json(await service.scheduleVisaEmbassyAppointment(req.auth, req.params.id, req.body));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = {
  assignRdv,
  suggestRdv,
  listMineForRdv,
  listForStudent,
  listMine,
  historyForStudent,
  markApplied,
  scheduleInterview,
  completeInterview,
  markAccepted,
  markRejected,
  closeApplication,
  reapply,
  markVisaSubmitted,
  markVisaAccepted,
  markVisaRejected,
  scheduleVisaPrepMeeting,
  scheduleVisaEmbassyAppointment
};
