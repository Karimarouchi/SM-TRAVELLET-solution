const adminService = require("../services/adminService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function dashboard(req, res) {
  try {
    res.json(await adminService.getDashboard(req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function board(req, res) {
  try {
    res.json(await adminService.getBoard());
  } catch (error) {
    handle(res, error);
  }
}

async function studentsOverview(req, res) {
  try {
    res.json(await adminService.getStudentsOverview());
  } catch (error) {
    handle(res, error);
  }
}

async function setStudentActive(req, res) {
  try {
    res.json(await adminService.setStudentActive(req.params.id, Boolean(req.body.isActive)));
  } catch (error) {
    handle(res, error);
  }
}

async function getSettings(req, res) {
  try {
    res.json(await adminService.getSettings());
  } catch (error) {
    handle(res, error);
  }
}

async function updateSettings(req, res) {
  try {
    res.json(await adminService.updateSettings(req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function autoAssign(req, res) {
  try {
    res.json(await adminService.setAutoAssign(Boolean(req.body.enabled)));
  } catch (error) {
    handle(res, error);
  }
}

async function createSales(req, res) {
  try {
    res.status(201).json(await adminService.createSales(req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function setSalesActive(req, res) {
  try {
    res.json(await adminService.setSalesActive(req.params.id, Boolean(req.body.isActive)));
  } catch (error) {
    handle(res, error);
  }
}

async function transferSales(req, res) {
  try {
    res.json(await adminService.transferAndBlockSales(req.params.id, req.body.toSalesId));
  } catch (error) {
    handle(res, error);
  }
}

async function deleteSales(req, res) {
  try {
    res.json(await adminService.deleteSales(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function getUserAccess(req, res) {
  try {
    res.json(await adminService.getUserAccess(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function setUserRoles(req, res) {
  try {
    res.json(await adminService.setUserRoles(req.params.id, req.body.roles));
  } catch (error) {
    handle(res, error);
  }
}

async function setUserPermissions(req, res) {
  try {
    res.json(await adminService.setUserPermissions(req.params.id, req.body.permissions));
  } catch (error) {
    handle(res, error);
  }
}

async function createRdv(req, res) {
  try {
    res.status(201).json(await adminService.createRdv(req.body));
  } catch (error) {
    handle(res, error);
  }
}

async function listRdv(req, res) {
  try {
    res.json(await adminService.listRdv());
  } catch (error) {
    handle(res, error);
  }
}

async function listUnassignedVisaApplications(req, res) {
  try {
    res.json(await adminService.listUnassignedVisaApplications());
  } catch (error) {
    handle(res, error);
  }
}

async function listRdvAssignments(req, res) {
  try {
    res.json(await adminService.listRdvAssignments());
  } catch (error) {
    handle(res, error);
  }
}

async function setRdvCountries(req, res) {
  try {
    res.json(await adminService.setRdvCountries(req.params.id, req.body.countryIds));
  } catch (error) {
    handle(res, error);
  }
}

async function listRdvStudents(req, res) {
  try {
    res.json(await adminService.listRdvStudents(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = { dashboard, board, studentsOverview, setStudentActive, autoAssign, getSettings, updateSettings, createSales, setSalesActive, transferSales, deleteSales, getUserAccess, setUserRoles, setUserPermissions, createRdv, listRdv, listRdvAssignments, listRdvStudents, setRdvCountries, listUnassignedVisaApplications };
