const hrService = require("../services/hrService");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

async function inbox(req, res) {
  try {
    res.json(await hrService.inbox());
  } catch (error) {
    handle(res, error);
  }
}

async function employees(req, res) {
  try {
    res.json(await hrService.listEmployees());
  } catch (error) {
    handle(res, error);
  }
}

async function updateEmployee(req, res) {
  try {
    res.json(await hrService.updateEmployee(req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function settings(req, res) {
  try {
    res.json(await hrService.getSettings());
  } catch (error) {
    handle(res, error);
  }
}

async function updateSettings(req, res) {
  try {
    res.json(await hrService.updateSettings(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function holidays(req, res) {
  try {
    res.json(await hrService.listHolidays());
  } catch (error) {
    handle(res, error);
  }
}

async function addHoliday(req, res) {
  try {
    res.status(201).json(await hrService.addHoliday(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function removeHoliday(req, res) {
  try {
    res.json(await hrService.removeHoliday(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function setHolidayPaid(req, res) {
  try {
    res.json(await hrService.setHolidayPaid(req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

const leave = require("../services/hrLeaveService");

async function leaveOverview(req, res) {
  try {
    res.json(await leave.overview());
  } catch (error) {
    handle(res, error);
  }
}

async function createLeave(req, res) {
  try {
    res.status(201).json(await leave.createRequest(req.auth, req.body || {}, { forSelf: false }));
  } catch (error) {
    handle(res, error);
  }
}

async function decideLeave(req, res) {
  try {
    res.json(await leave.decide(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

const leaveCovers = require("../services/hrLeaveCoverService");

async function leaveCoverOptions(req, res) {
  try {
    res.json(await leaveCovers.options({ userId: req.query.user, startOn: req.query.start, endOn: req.query.end, leaveId: req.query.leave || null }));
  } catch (error) {
    handle(res, error);
  }
}

async function updateLeaveCover(req, res) {
  try {
    res.json(await leaveCovers.update(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function myLeaveCover(req, res) {
  try {
    res.json(await leaveCovers.mine(req.auth));
  } catch (error) {
    handle(res, error);
  }
}

async function settleLeave(req, res) {
  try {
    res.json(await leave.settle(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function setLeaveBalance(req, res) {
  try {
    res.json(await leave.setBalance(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function leaveAbsences(req, res) {
  try {
    res.json(await attendance.absenceDays(req.query.user));
  } catch (error) {
    handle(res, error);
  }
}

async function coverLeaveAbsences(req, res) {
  try {
    res.status(201).json(await leave.coverAbsences(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function myLeave(req, res) {
  try {
    res.json(await leave.mine(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function myHolidays(req, res) {
  try {
    res.json(await hrService.listHolidays());
  } catch (error) {
    handle(res, error);
  }
}

async function previewMyLeave(req, res) {
  try {
    res.json(await leave.previewRequest(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function requestMyLeave(req, res) {
  try {
    res.status(201).json(await leave.createRequest(req.auth, req.body || {}, { forSelf: true }));
  } catch (error) {
    handle(res, error);
  }
}

const attendance = require("../services/hrAttendanceService");

async function attendanceMonth(req, res) {
  try {
    res.json(await attendance.overview(req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function saveAttendanceDay(req, res) {
  try {
    res.json(await attendance.saveDay(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function saveAttendanceAmount(req, res) {
  try {
    res.json(await attendance.saveMonthAmount(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function confirmAttendanceAbsences(req, res) {
  try {
    res.json(await attendance.confirmAbsences(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

const payroll = require("../services/hrPayrollService");
const pdf = require("../services/hrPdfService");
const fs = require("fs");

async function payrollMonth(req, res) {
  try {
    res.json(await payroll.overview(req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function setPayrollCommission(req, res) {
  try {
    res.json(await payroll.setIncludedCommission(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function savePayrollAdjustment(req, res) {
  try {
    res.json(await payroll.saveAdjustment(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function issuePayslip(req, res) {
  try {
    res.status(201).json(await payroll.issue(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function reopenPayslip(req, res) {
  try {
    res.json(await payroll.reopen({ ...(req.body || {}), ...req.query }));
  } catch (error) {
    handle(res, error);
  }
}

async function payslipPdf(req, res) {
  try {
    const slip = await payroll.loadIssued(req.params.userId, req.query.month);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Fiche-paie-${slip.month}.pdf"`);
    pdf.renderPayslip(slip, res);
    await payroll.reportUnpaidCommissions(req.params.userId, slip.month);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function importPayslipPreview(req, res) {
  try {
    res.json(await require("../services/hrPayslipImportService").preview(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function confirmPayslipImport(req, res) {
  try {
    res.status(201).json(await require("../services/hrPayslipImportService").confirm(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function removeOfficialPayslip(req, res) {
  try {
    res.json(await require("../services/hrPayslipImportService").remove(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

function sendBulletin(file, res) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  fs.createReadStream(file.absolutePath).pipe(res);
}

async function officialPayslipPdf(req, res) {
  try {
    if (String(req.query.original || "") === "1") {
      const file = await require("../services/hrPayslipImportService").openFile(req.params.userId, req.query.month);
      if (!file) throw Object.assign(new Error("Aucun bulletin officiel pour ce mois."), { status: 404 });
      sendBulletin(file, res);
      return;
    }
    const bulletin = await payroll.loadBulletin(req.params.userId, req.query.month);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Fiche-paie-${bulletin.month}.pdf"`);
    pdf.renderBulletin(bulletin, res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function fichesPdf(req, res) {
  try {
    const months = String(req.query.months || "").split(",").map((value) => value.trim()).filter(Boolean);
    const pages = await payroll.loadFiches(req.params.userId, months);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Fiches-paie.pdf"`);
    pdf.renderFiches(pages, res);
    for (const page of pages) {
      if (page.kind === "calculated") await payroll.reportUnpaidCommissions(req.params.userId, page.month);
    }
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function accountantPdf(req, res) {
  try {
    const slip = await payroll.loadAccountant(req.params.userId, req.query.month);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Elements-paie-${slip.month}.pdf"`);
    pdf.renderAccountant(slip, res);
    await payroll.reportUnpaidCommissions(req.params.userId, slip.month);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function myPayslipPdf(req, res) {
  try {
    if (req.query.months) {
      const months = [...new Set(String(req.query.months).split(",").map((value) => value.trim()).filter(Boolean))].sort();
      if (!months.length) throw Object.assign(new Error("Choisis au moins un mois."), { status: 400 });
      for (const month of months) await payroll.assertEmployeeDownload(req.auth.sub, "PAYSLIP", month);
      const pages = [];
      for (const month of months) {
        const bulletin = await payroll.loadBulletin(req.auth.sub, month).catch((error) => {
          if (error.status === 404) return null;
          throw error;
        });
        if (bulletin) pages.push({ kind: "bulletin", ...bulletin });
        else pages.push({ kind: "calculated", ...(await payroll.loadIssued(req.auth.sub, month)) });
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=\"Fiches-paie.pdf\"");
      pdf.renderFiches(pages, res);
      return;
    }
    await payroll.assertEmployeeDownload(req.auth.sub, "PAYSLIP", req.query.month);
    const bulletin = await payroll.loadBulletin(req.auth.sub, req.query.month).catch((error) => {
      if (error.status === 404) return null;
      throw error;
    });
    if (bulletin) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Fiche-paie-${bulletin.month}.pdf"`);
      pdf.renderBulletin(bulletin, res);
      return;
    }
    const slip = await payroll.loadIssued(req.auth.sub, req.query.month);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Fiche-paie-${slip.month}.pdf"`);
    pdf.renderPayslip(slip, res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function attestationPdf(req, res) {
  try {
    const data = await payroll.attestation(req.params.userId, String(req.query.type || ""));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdf.FILENAMES[data.type]}.pdf"`);
    pdf.renderAttestation(data, res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function addPayrollEntry(req, res) {
  try {
    res.status(201).json(await payroll.addEntry(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function removePayrollEntry(req, res) {
  try {
    res.json(await payroll.removeEntry(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function myAttestationPdf(req, res) {
  try {
    const type = String(req.query.type || "");
    if (type === "work") await payroll.assertEmployeeDownload(req.auth.sub, "WORK");
    const data = await payroll.attestation(req.auth.sub, type);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdf.FILENAMES[data.type]}.pdf"`);
    pdf.renderAttestation(data, res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function myDocuments(req, res) {
  try {
    res.json(await payroll.myDocuments(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function myDocumentFile(req, res) {
  try {
    const file = await payroll.openDocument(req.params.id, req.auth.sub);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`);
    fs.createReadStream(file.absolutePath).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function myPayslips(req, res) {
  try {
    res.json(await payroll.myPayslips(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function payrollBranding(req, res) {
  try {
    res.json(await payroll.branding());
  } catch (error) {
    handle(res, error);
  }
}

async function savePayrollBrand(req, res) {
  try {
    res.json(await payroll.saveBrandFile(req.params.kind, (req.body || {}).file));
  } catch (error) {
    handle(res, error);
  }
}

async function payrollBrandFile(req, res) {
  try {
    const file = await payroll.readBrand(req.params.kind);
    res.setHeader("Content-Type", file.mimeType);
    fs.createReadStream(file.absolutePath).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function employeeDossier(req, res) {
  try {
    res.json(await payroll.dossier(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

async function addEmployeeDocument(req, res) {
  try {
    res.status(201).json(await payroll.addDocument(req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function employeeDocumentFile(req, res) {
  try {
    const file = await payroll.openDocument(req.params.id);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`);
    fs.createReadStream(file.absolutePath).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function removeEmployeeDocument(req, res) {
  try {
    res.json(await payroll.removeDocument(req.params.id));
  } catch (error) {
    handle(res, error);
  }
}

const absence = require("../services/hrAbsenceService");

async function absenceMonth(req, res) {
  try {
    res.json(await absence.overview(req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function submitAbsenceCertificate(req, res) {
  try {
    res.json(await absence.submit(req.body?.userId, req.body || {}, { sub: req.auth.sub, role: "ADMIN" }));
  } catch (error) {
    handle(res, error);
  }
}

async function acceptAbsenceCertificate(req, res) {
  try {
    res.json(await absence.accept(req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function absenceCertificateFile(req, res) {
  try {
    const file = await absence.openFile(req.query.userId, req.query.day);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`);
    fs.createReadStream(file.absolutePath).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function myAbsences(req, res) {
  try {
    res.json(await absence.mine(req.auth.sub, req.query));
  } catch (error) {
    handle(res, error);
  }
}

async function submitMyAbsenceCertificate(req, res) {
  try {
    const role = req.auth.role === "ADMIN" ? "ADMIN" : "STAFF";
    res.json(await absence.submit(req.auth.sub, req.body || {}, { sub: req.auth.sub, role }));
  } catch (error) {
    handle(res, error);
  }
}

async function myAbsenceCertificateFile(req, res) {
  try {
    const file = await absence.openFile(req.auth.sub, req.query.day);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`);
    fs.createReadStream(file.absolutePath).pipe(res);
  } catch (error) {
    if (res.headersSent) return res.end();
    handle(res, error);
  }
}

async function myDocumentRequests(req, res) {
  try {
    res.json(await payroll.myDocumentRequests(req.auth.sub));
  } catch (error) {
    handle(res, error);
  }
}

async function requestDocument(req, res) {
  try {
    res.status(201).json(await payroll.requestDocument(req.auth, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

async function documentRequests(req, res) {
  try {
    res.json(await payroll.listDocumentRequests());
  } catch (error) {
    handle(res, error);
  }
}

async function decideDocumentRequest(req, res) {
  try {
    res.json(await payroll.decideDocumentRequest(req.auth, req.params.id, req.body || {}));
  } catch (error) {
    handle(res, error);
  }
}

module.exports = {
  inbox,
  employees,
  updateEmployee,
  settings,
  updateSettings,
  holidays,
  addHoliday,
  removeHoliday,
  setHolidayPaid,
  leaveOverview,
  createLeave,
  decideLeave,
  leaveCoverOptions,
  updateLeaveCover,
  myLeaveCover,
  settleLeave,
  setLeaveBalance,
  leaveAbsences,
  coverLeaveAbsences,
  myLeave,
  myHolidays,
  previewMyLeave,
  requestMyLeave,
  attendanceMonth,
  saveAttendanceDay,
  saveAttendanceAmount,
  confirmAttendanceAbsences,
  payrollMonth,
  savePayrollAdjustment,
  setPayrollCommission,
  addPayrollEntry,
  removePayrollEntry,
  issuePayslip,
  importPayslipPreview,
  confirmPayslipImport,
  removeOfficialPayslip,
  officialPayslipPdf,
  accountantPdf,
  fichesPdf,
  reopenPayslip,
  payslipPdf,
  myPayslipPdf,
  myAttestationPdf,
  myDocuments,
  myDocumentFile,
  attestationPdf,
  myPayslips,
  myDocumentRequests,
  requestDocument,
  documentRequests,
  decideDocumentRequest,
  payrollBranding,
  savePayrollBrand,
  payrollBrandFile,
  employeeDossier,
  addEmployeeDocument,
  employeeDocumentFile,
  removeEmployeeDocument,
  absenceMonth,
  submitAbsenceCertificate,
  acceptAbsenceCertificate,
  absenceCertificateFile,
  myAbsences,
  submitMyAbsenceCertificate,
  myAbsenceCertificateFile
};
