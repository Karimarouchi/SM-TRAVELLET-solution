const hrRepo = require("../repositories/hrRepository");
const settings = require("../repositories/settingsRepository");
const notificationService = require("./notificationService");

const CONTRACTS = ["CDI", "CIVP", "CDD"];

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// CDI : 2 jours par mois, sans date de fin. CIVP : 1,5. CDD : le chiffre saisi par l'admin, avec une date de fin.
function monthlyLeave(contractType, custom) {
  if (contractType === "CDI") return 2;
  if (contractType === "CIVP") return 1.5;
  return num(custom);
}

function employeeDto(row) {
  const extra = Array.isArray(row.extra_roles) ? row.extra_roles : [];
  const roles = [...new Set([row.base_role, ...extra])].filter((role) => role && role !== "STUDENT");
  const contractType = row.contract_type || null;
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    email: row.email,
    roles,
    isActive: row.is_active !== false,
    contractType,
    hiredOn: row.hired_on || null,
    contractEndsOn: row.contract_ends_on || null,
    cin: row.cin || "",
    cnssNumber: row.cnss_number || "",
    rib: row.rib || "",
    baseSalary: num(row.base_salary),
    leaveDaysPerMonth: contractType ? monthlyLeave(contractType, row.leave_days_per_month) : null,
    leaveDaysCustom: num(row.leave_days_per_month)
  };
}

function cleanDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw fail("Date invalide.");
  return text;
}

function cleanText(value, max) {
  const text = String(value || "").trim();
  if (text.length > max) throw fail(`Texte trop long (${max} caractères maximum).`);
  return text || null;
}

async function listEmployees() {
  const rows = await hrRepo.listStaff();
  return rows.map(employeeDto);
}

async function updateEmployee(userId, body) {
  const existing = await hrRepo.findStaff(userId);
  if (!existing) throw fail("Employé introuvable.", 404);

  const contractType = String(body.contractType || "").trim();
  if (!CONTRACTS.includes(contractType)) throw fail("Contrat invalide.");

  const hiredOn = cleanDate(body.hiredOn);
  const contractEndsOn = contractType === "CDI" ? null : cleanDate(body.contractEndsOn);
  if (contractType === "CDD" && !contractEndsOn) throw fail("Un CDD doit avoir une date de fin de contrat.");
  if (hiredOn && contractEndsOn && contractEndsOn < hiredOn) throw fail("La fin de contrat est avant l'embauche.");

  let baseSalary = null;
  if (body.baseSalary !== null && body.baseSalary !== undefined && String(body.baseSalary).trim() !== "") {
    baseSalary = Number(String(body.baseSalary).replace(",", "."));
    if (!Number.isFinite(baseSalary) || baseSalary < 0) throw fail("Salaire de base invalide.");
  }

  let leaveDays = null;
  if (contractType === "CDD") {
    if (body.leaveDaysPerMonth !== null && body.leaveDaysPerMonth !== undefined && String(body.leaveDaysPerMonth).trim() !== "") {
      leaveDays = Number(String(body.leaveDaysPerMonth).replace(",", "."));
      if (!Number.isFinite(leaveDays) || leaveDays < 0 || leaveDays > 31) throw fail("Jours de congé par mois invalides.");
    }
  }

  await hrRepo.upsertEmployee(userId, {
    contractType,
    hiredOn,
    contractEndsOn,
    cin: cleanText(body.cin, 20),
    cnssNumber: cleanText(body.cnssNumber, 30),
    rib: cleanText(body.rib, 40),
    baseSalary,
    leaveDaysPerMonth: leaveDays
  });
  return employeeDto(await hrRepo.findStaff(userId));
}

async function getSettings() {
  const [divisor, hours, since, notice, cddNotice] = await Promise.all([
    settings.get("hr_day_divisor"),
    settings.get("hr_cert_delay_hours"),
    settings.get("hr_attendance_since"),
    settings.get("hr_leave_notice_factor"),
    settings.get("hr_cdd_notice_days")
  ]);
  const dayDivisor = parseInt(divisor, 10);
  const certDelayHours = parseInt(hours, 10);
  const leaveNoticeFactor = parseInt(notice, 10);
  const cddNoticeDays = parseInt(cddNotice, 10);
  let attendanceSince = /^\d{4}-\d{2}-\d{2}$/.test(since || "") ? since : "";
  if (!attendanceSince) {
    attendanceSince = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    await settings.set("hr_attendance_since", attendanceSince);
  }
  return {
    dayDivisor: Number.isFinite(dayDivisor) && dayDivisor > 0 ? dayDivisor : 26,
    certDelayHours: Number.isFinite(certDelayHours) && certDelayHours > 0 ? certDelayHours : 72,
    attendanceSince,
    leaveNoticeFactor: Number.isFinite(leaveNoticeFactor) && leaveNoticeFactor >= 0 ? leaveNoticeFactor : 0,
    cddNoticeDays: Number.isFinite(cddNoticeDays) && cddNoticeDays >= 0 ? cddNoticeDays : 30
  };
}

async function updateSettings(body) {
  const dayDivisor = parseInt(body.dayDivisor, 10);
  const certDelayHours = parseInt(body.certDelayHours, 10);
  if (!Number.isFinite(dayDivisor) || dayDivisor < 1 || dayDivisor > 31) throw fail("Le diviseur d'un jour de salaire doit être entre 1 et 31.");
  if (!Number.isFinite(certDelayHours) || certDelayHours < 1 || certDelayHours > 240) throw fail("Le délai du certificat doit être entre 1 et 240 heures.");
  const attendanceSince = String(body.attendanceSince || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceSince)) throw fail("La date de début du pointage est invalide.");
  const leaveNoticeFactor = parseInt(body.leaveNoticeFactor, 10);
  if (!Number.isInteger(leaveNoticeFactor) || leaveNoticeFactor < 0 || leaveNoticeFactor > 30) throw fail("Le préavis de congé doit être un nombre entre 0 et 30.");
  const cddNoticeDays = parseInt(body.cddNoticeDays, 10);
  if (!Number.isInteger(cddNoticeDays) || cddNoticeDays < 0 || cddNoticeDays > 365) throw fail("L'alerte de fin de CDD doit être un nombre de jours entre 0 et 365.");
  await settings.set("hr_day_divisor", dayDivisor);
  await settings.set("hr_cert_delay_hours", certDelayHours);
  await settings.set("hr_attendance_since", attendanceSince);
  await settings.set("hr_leave_notice_factor", leaveNoticeFactor);
  await settings.set("hr_cdd_notice_days", cddNoticeDays);
  return getSettings();
}

function todayIso(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftIso(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function remindEndingContracts(now = new Date()) {
  const { cddNoticeDays } = await getSettings();
  if (!cddNoticeDays) return { sent: 0 };
  const today = todayIso(now);
  const rows = await hrRepo.listEndingContracts();
  let sent = 0;
  for (const row of rows) {
    const start = shiftIso(row.contract_ends_on, -cddNoticeDays);
    if (today < start || today > row.contract_ends_on) continue;
    const claimed = await hrRepo.claimContractReminder(row.id, row.contract_ends_on);
    if (!claimed) continue;
    const name = `${row.prenom} ${row.nom}`.trim();
    const when = new Date(`${row.contract_ends_on}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
    const left = Math.round((Date.parse(`${row.contract_ends_on}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
    await notificationService.notifyAdmins({
      type: "HR_CONTRACT_ENDING",
      title: `Fin de CDD : ${name}`,
      body: left <= 0 ? `Le contrat de ${name} se termine aujourd'hui, le ${when}.` : `Le contrat de ${name} se termine le ${when}, dans ${left} jour(s).`,
      link: "/admin/rh/employes"
    });
    sent += 1;
  }
  return { sent };
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

async function inbox(now = new Date()) {
  const today = todayIso(now);
  const month = today.slice(0, 7);
  const rules = await getSettings();
  const leaveService = require("./hrLeaveService");
  const attendance = require("./hrAttendanceService");
  const absence = require("./hrAbsenceService");
  const payroll = require("./hrPayrollService");
  const [people, presence, certificates, slips, holidays] = await Promise.all([
    leaveService.overview(),
    attendance.overview({ month }),
    absence.overview({ month }),
    payroll.overview({ month }),
    listHolidays()
  ]);
  const leave = [];
  for (const person of people) {
    for (const request of person.requests) {
      if (request.status !== "PENDING") continue;
      leave.push({
        id: request.id,
        userId: person.id,
        prenom: person.prenom,
        nom: person.nom,
        startOn: request.startOn,
        endOn: request.endOn,
        days: request.days,
        reason: request.reason || ""
      });
    }
  }
  const absences = [];
  for (const person of presence.employees) {
    for (const day of person.days || []) {
      if ((day.status !== "ABSENT" && day.status !== "NO_REPLY") || day.confirmed) continue;
      absences.push({ userId: person.id, prenom: person.prenom, nom: person.nom, day: day.day, status: day.status });
    }
  }
  const lateCertificates = [];
  for (const person of certificates.employees) {
    for (const day of person.days) {
      if (!day.submitted || day.accepted) continue;
      lateCertificates.push({ userId: person.id, prenom: person.prenom, nom: person.nom, day: day.day });
    }
  }
  const contracts = [];
  if (rules.cddNoticeDays > 0) {
    for (const person of slips.employees) {
      if (person.contractType !== "CDD" || !person.contractEndsOn) continue;
      const daysLeft = daysBetween(today, person.contractEndsOn);
      if (daysLeft < 0 || daysLeft > rules.cddNoticeDays) continue;
      contracts.push({
        userId: person.id,
        prenom: person.prenom,
        nom: person.nom,
        contractEndsOn: person.contractEndsOn,
        daysLeft
      });
    }
  }
  const payrollDrafts = slips.employees
    .filter((person) => person.hiredOn && !person.issued)
    .map((person) => ({ userId: person.id, prenom: person.prenom, nom: person.nom, net: person.lines.net }));
  const payable = slips.employees.filter((person) => person.hiredOn);
  const round3 = (value) => Math.round(value * 1000) / 1000;
  const sum = (rows, pick) => round3(rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0));
  const contractCounts = { CDI: 0, CIVP: 0, CDD: 0, none: 0 };
  for (const person of slips.employees) {
    const key = contractCounts[person.contractType] === undefined ? "none" : person.contractType;
    contractCounts[key] += 1;
  }
  const onLeave = [];
  let openYears = 0;
  for (const person of people) {
    openYears += person.openYears.length;
    const current = person.requests.find((request) => request.status === "APPROVED" && request.startOn <= today && today <= request.endOn);
    if (current) onLeave.push({ userId: person.id, prenom: person.prenom, nom: person.nom, endOn: current.endOn });
  }
  let pendingLateDays = 0;
  let pendingLateMinutes = 0;
  for (const person of presence.employees) {
    for (const day of person.days || []) {
      const detected = Number(day.lateMinutes || 0) + Number(day.earlyMinutes || 0);
      if (day.status === "PRESENT" && !day.confirmedLate && detected > 0) {
        pendingLateDays += 1;
        pendingLateMinutes += detected;
      }
    }
  }
  const summary = {
    month,
    today,
    headcount: slips.employees.length,
    ready: slips.employees.filter((person) => person.hiredOn && person.contractType).length,
    incomplete: slips.employees.filter((person) => !person.hiredOn || !person.contractType).length,
    contracts: contractCounts,
    onLeave,
    openYears,
    pendingLateDays,
    pendingLateMinutes,
    presenceMinutes: sum(presence.employees, (row) => row.totalMinutes),
    presenceCost: sum(presence.employees, (row) => row.amount),
    payroll: {
      drafts: payrollDrafts.length,
      issued: payable.filter((person) => person.issued).length,
      net: sum(payable, (row) => row.lines.net),
      commissions: sum(payable, (row) => row.lines.commissions),
      deductions: sum(payable, (row) => Number(row.lines.absenceDeduction) + Number(row.lines.latenessDeduction) + Number(row.lines.unpaidHolidayDeduction)),
      hasSignature: slips.hasSignature,
      hasStamp: slips.hasStamp
    },
    nextHoliday: holidays.find((row) => row.day >= today) || null
  };
  const documentRequests = await payroll.listDocumentRequests();
  const due = slips.salaryDue && slips.salaryDue.show ? slips.salaryDue : null;
  const unpaidSalaries = due
    ? due.unpaid.map((row) => ({ userId: row.id, prenom: row.prenom, nom: row.nom, amount: row.amount, month: due.month }))
    : [];
  return { leave, absences, lateCertificates, contracts, payrollDrafts, documentRequests, unpaidSalaries, summary };
}

async function listHolidays() {
  return hrRepo.listHolidays();
}

async function addHoliday(body) {
  const day = cleanDate(body.day);
  if (!day) throw fail("La date du jour férié est obligatoire.");
  const label = cleanText(body.label, 120);
  if (!label) throw fail("Le nom du jour férié est obligatoire.");
  try {
    return await hrRepo.insertHoliday(day, label, body.paid !== false);
  } catch (error) {
    if (error.code === "23505") throw fail("Ce jour est déjà dans la liste.");
    throw error;
  }
}

async function removeHoliday(id) {
  const removed = await hrRepo.deleteHoliday(id);
  if (!removed) throw fail("Jour férié introuvable.", 404);
  return { ok: true };
}

async function setHolidayPaid(id, body) {
  const updated = await hrRepo.setHolidayPaid(id, body.paid === true);
  if (!updated) throw fail("Jour férié introuvable.", 404);
  return updated;
}

module.exports = {
  listEmployees,
  updateEmployee,
  getSettings,
  updateSettings,
  listHolidays,
  addHoliday,
  removeHoliday,
  setHolidayPaid,
  remindEndingContracts,
  inbox,
  promoteCivp: () => hrRepo.promoteCivp(),
  monthlyLeave
};
