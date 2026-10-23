const fs = require("fs");
const path = require("path");
const hrRepo = require("../repositories/hrRepository");
const payrollRepo = require("../repositories/hrPayrollRepository");
const settings = require("../repositories/settingsRepository");
const attendance = require("./hrAttendanceService");
const leaveService = require("./hrLeaveService");
const absenceRepo = require("../repositories/hrAbsenceRepository");
const { buildPayslip, advanceAccount, settleAdvance, unpaidHolidayDeduction } = require("./payrollRules");
const payslipImport = require("./hrPayslipImportService");

const HR_DIR = path.join(__dirname, "../../uploads/hr");
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function monthParts(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || ""));
  if (!match) throw fail("Mois invalide.");
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw fail("Mois invalide.");
  return { year: Number(match[1]), month, key: `${match[1]}-${match[2]}`, start: `${match[1]}-${match[2]}-01` };
}

function nextMonth(year, month) {
  const next = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(next).padStart(2, "0")}-01 00:00:00`;
}

function money(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  const amount = Number(String(value).replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0) throw fail("Montant invalide.");
  return Math.round(amount * 1000) / 1000;
}

function num(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function jobTitleOf(row) {
  const title = String(row.job_title || "").trim();
  if (title) return title;
  const roles = rolesOf(row);
  if (roles.includes("SALES")) return "Conseiller";
  if (roles.includes("RDV")) return "Responsable dossier";
  return "Employé";
}

function rolesOf(row) {
  const extra = Array.isArray(row.extra_roles) ? row.extra_roles : [];
  return [...new Set([row.base_role, ...extra])].filter((role) => role && role !== "STUDENT");
}

function linesFromSlip(row) {
  return {
    baseSalary: num(row.base_salary),
    commissions: num(row.commissions),
    includedCommissions: num(row.included_commissions),
    bonus: num(row.bonus),
    paidLeave: num(row.paid_leave),
    absenceDeduction: num(row.absence_deduction),
    latenessDeduction: num(row.lateness_deduction),
    presenceAdjustment: row.presence_adjustment === null || row.presence_adjustment === undefined ? null : num(row.presence_adjustment),
    advance: num(row.advance),
    net: num(row.net),
    unpaidHolidayDeduction: num(row.unpaid_holiday_deduction),
    advanceBalance: row.advance_balance === null || row.advance_balance === undefined ? null : num(row.advance_balance)
  };
}

function pricedPresence(employee, justified) {
  const round3 = (value) => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
  let drop = 0;
  let absence = 0;
  let lateness = 0;
  for (const day of employee?.days || []) {
    const covered = justified.has(`${employee.id}|${day.day}`);
    if (covered) {
      drop += day.totalMinutes;
      continue;
    }
    if (day.status === "ABSENT" || day.status === "NO_REPLY") absence += day.totalMinutes;
    else if (day.status === "PRESENT") lateness += day.totalMinutes;
  }
  const total = employee?.totalMinutes || 0;
  const computed = employee?.computedAmount;
  const computedAmount = computed === null || computed === undefined || !total ? computed ?? 0 : round3((computed * (total - drop)) / total);
  return { computedAmount, absence, lateness };
}

function decodeFile(fileBase64, allowed) {
  const match = String(fileBase64 || "").match(/^data:([^;,]*);base64,([\s\S]+)$/);
  if (!match) throw fail("Format de fichier non supporté.");
  let mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw fail("Le fichier est invalide ou dépasse 3 Mo.");
  if (!mimeType || mimeType === "application/octet-stream") {
    if (buffer[0] === 0xff && buffer[1] === 0xd8) mimeType = "image/jpeg";
    else if (buffer[0] === 0x89 && buffer.toString("ascii", 1, 4) === "PNG") mimeType = "image/png";
  }
  const accepted = allowed.map((type) => (type === "image/jpg" ? "image/jpeg" : type));
  if (!accepted.includes(mimeType)) throw fail("Format de fichier non supporté.");
  return { mimeType, buffer };
}

function storeFile(prefix, mimeType, buffer) {
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  try {
    fs.mkdirSync(HR_DIR, { recursive: true });
    const storedFilename = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(HR_DIR, storedFilename), buffer);
    return storedFilename;
  } catch {
    throw fail("Le serveur n'a pas pu enregistrer l'image. Le dossier des fichiers n'est pas accessible.");
  }
}

function removeFile(filename) {
  if (!filename) return;
  const absolute = path.join(HR_DIR, path.basename(filename));
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
}

async function brandingFiles() {
  const [signature, stamp] = await Promise.all([settings.get("hr_signature_file"), settings.get("hr_stamp_file")]);
  const file = (name) => (name && fs.existsSync(path.join(HR_DIR, path.basename(name))) ? path.join(HR_DIR, path.basename(name)) : null);
  const signaturePath = file(signature);
  const stampPath = file(stamp);
  return { signature: signaturePath, stamp: stampPath, hasSignature: Boolean(signaturePath), hasStamp: Boolean(stampPath) };
}

async function monthContext(monthValue) {
  const parts = monthParts(monthValue);
  const work = await settings.getWorkHoursConfig();
  const timeZone = work.timezone || "Africa/Tunis";
  const from = `${parts.start} 00:00:00`;
  const to = nextMonth(parts.year, parts.month);
  const [staff, attendanceMonth, commissions, unpaidCommissions, paidCommissionRows, paidLeave, adjustments, slips, official, officialMonths] = await Promise.all([
    hrRepo.listStaff(),
    attendance.overview({ month: parts.key }),
    payrollRepo.commissionsByUser(from, to, timeZone),
    payrollRepo.unpaidCommissionsByUser(to, timeZone),
    payrollRepo.paidCommissions(from, to, timeZone, parts.start),
    payrollRepo.paidLeaveByUser(from, to, timeZone),
    payrollRepo.listAdjustments(parts.start),
    payrollRepo.listPayslips(parts.start),
    payrollRepo.listOfficialForMonth(parts.start),
    payrollRepo.listOfficialMonths()
  ]);
  const documents = await payrollRepo.listDocumentsForUsers(staff.map((row) => row.id));
  const entries = await payrollRepo.listEntries();
  const [monthPayments, yearPayments] = await Promise.all([
    payrollRepo.listSalaryPaymentsForMonth(parts.start),
    payrollRepo.listSalaryPaymentsForYear(parts.year)
  ]);
  const monthEnd = nextMonth(parts.year, parts.month).slice(0, 10);
  const certificates = await absenceRepo.listBetween(parts.start, monthEnd);
  const justified = new Set(certificates.filter((row) => row.accepted === true).map((row) => `${row.user_id}|${row.day}`));
  return {
    parts,
    staff,
    attendanceMonth,
    commissions,
    unpaidCommissions,
    paidCommissionRows,
    paidLeave,
    adjustments,
    slips,
    official,
    officialMonths,
    documents,
    justified,
    entries,
    monthPayments,
    yearPayments,
    divisor: attendanceMonth.dayDivisor
  };
}

function previewFor(row, context) {
  const presence = context.attendanceMonth.employees.find((employee) => employee.id === row.id);
  const priced = pricedPresence(presence, context.justified);
  const commission = context.commissions.find((item) => item.user_id === row.id);
  const unpaid = (context.unpaidCommissions || []).find((item) => item.user_id === row.id);
  const unpaidCommissions = unpaid ? Number(unpaid.total) : 0;
  const includedCommissions = (context.paidCommissionRows || [])
    .filter((item) => item.user_id === row.id && item.included_month && String(item.included_month).slice(0, 10) === context.parts.start)
    .reduce((sum, item) => sum + Number(item.amount_dinar), 0);
  const leavePay = context.paidLeave.find((item) => item.user_id === row.id);
  const account = advanceAccount(
    context.entries.filter((entry) => entry.user_id === row.id).map((entry) => ({ ...entry, month: String(entry.month).slice(0, 10) })),
    context.parts.start
  );
  const slipInput = {
    baseSalary: row.base_salary === null || row.base_salary === undefined ? 0 : Number(row.base_salary),
    commissions: commission ? Number(commission.total) : 0,
    includedCommissions,
    bonus: account.bonus,
    paidLeave: leavePay ? Number(leavePay.total) : 0,
    computedAmount: priced.computedAmount,
    monthAmount: presence ? presence.monthAmount : null,
    absenceMinutes: priced.absence,
    latenessMinutes: priced.lateness,
    unpaidHolidayDeduction: unpaidHolidayDeduction({
      salary: row.base_salary,
      divisor: context.divisor,
      days: presence ? presence.days : []
    })
  };
  const due = buildPayslip({ ...slipInput, advance: 0 });
  const settlement = settleAdvance({
    salaryDue: due.net,
    carried: account.advanceCarried,
    granted: account.advanceGranted,
    requested: account.advance
  });
  const lines = buildPayslip({ ...slipInput, advance: settlement.advance });
  return { ...lines, ...account, ...settlement, bonus: lines.bonus, advance: lines.advance, unpaidCommissions };
}

function employeeDto(row, context) {
  const slip = context.slips.find((item) => item.user_id === row.id);
  const adjustment = context.adjustments.find((item) => item.user_id === row.id);
  const live = previewFor(row, context);
  const stored = slip ? linesFromSlip(slip) : null;
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    roles: rolesOf(row),
    contractType: row.contract_type || null,
    hiredOn: row.hired_on || null,
    contractEndsOn: row.contract_ends_on || null,
    cin: row.cin || "",
    cnssNumber: row.cnss_number || "",
    absenceDays: (context.attendanceMonth.employees.find((employee) => employee.id === row.id)?.days || [])
      .filter((day) => day.confirmed && (day.status === "ABSENT" || day.status === "UNPAID_HOLIDAY")).length,
    latenessMinutes: (context.attendanceMonth.employees.find((employee) => employee.id === row.id)?.days || [])
      .filter((day) => day.status === "PRESENT")
      .reduce((sum, day) => sum + (day.totalMinutes || 0), 0),
    lines: stored ? { ...live, ...stored, advanceBalance: stored.advanceBalance ?? live.advanceBalance, includedCommissions: stored.includedCommissions, unpaidCommissions: live.unpaidCommissions } : live,
    paidCommissions: (context.paidCommissionRows || [])
      .filter((item) => item.user_id === row.id)
      .map((item) => ({
        id: item.id,
        student: `${item.student_prenom} ${item.student_nom}`.trim(),
        stage: item.stage,
        amount: num(item.amount_dinar),
        paidAt: item.paid_at,
        paidThisMonth: item.paid_this_month === true,
        included: item.included_month ? String(item.included_month).slice(0, 10) === context.parts.start : false,
        includedMonth: item.included_month ? String(item.included_month).slice(0, 7) : null
      })),
    entries: context.entries
      .filter((entry) => entry.user_id === row.id && String(entry.month).slice(0, 10) === context.parts.start)
      .map((entry) => ({ id: entry.id, kind: entry.kind, label: entry.label, amount: num(entry.amount) })),
    note: slip ? slip.note || "" : adjustment?.note || "",
    issued: Boolean(slip),
    issuedAt: slip ? slip.issued_at : null,
    official: payslipImport.officialOf((context.official || []).find((item) => item.user_id === row.id)),
    officialMonths: (context.officialMonths || []).filter((item) => item.user_id === row.id).map((item) => item.month),
    documents: context.documents
      .filter((document) => document.user_id === row.id)
      .map((document) => ({
        id: document.id,
        label: document.label,
        originalFilename: document.original_filename,
        createdAt: document.created_at
      })),
    payment: mapPayment((context.monthPayments || []).find((item) => item.user_id === row.id))
  };
}

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    prenom: row.prenom,
    nom: row.nom,
    month: String(row.month).slice(0, 7),
    amount: num(row.amount),
    paidOn: String(row.paid_on).slice(0, 10)
  };
}

function payableOf(employee) {
  const amount = employee.official ? Number(employee.official.netToPay) : Number(employee.lines?.net);
  return Number.isFinite(amount) ? Math.round(amount * 1000) / 1000 : 0;
}

function tunisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function paymentDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : `${match[1]}-${match[2]}-${match[3]}`;
}

async function overview(query) {
  const context = await monthContext(query.month);
  const brand = await brandingFiles();
  const employees = context.staff.map((row) => employeeDto(row, context));
  return {
    month: context.parts.key,
    hasSignature: brand.hasSignature,
    hasStamp: brand.hasStamp,
    employees,
    payments: (context.yearPayments || []).map(mapPayment),
    salaryDue: await salaryReminder(context, employees)
  };
}

async function salaryReminder(context, employees) {
  const today = tunisToday();
  const day = Number(today.slice(8, 10));
  const monthKey = today.slice(0, 7);
  if (day < 26) return { show: false, month: monthKey, unpaid: [] };
  let people = employees;
  if (context.parts.key !== monthKey) {
    const current = await monthContext(monthKey);
    people = current.staff.map((row) => employeeDto(row, current));
  }
  const unpaid = people
    .filter((employee) => payableOf(employee) > 0 && !employee.payment)
    .map((employee) => ({ id: employee.id, prenom: employee.prenom, nom: employee.nom, amount: payableOf(employee) }));
  if (unpaid.length) await notifySalaryDue(monthKey, unpaid.length);
  return { show: unpaid.length > 0, month: monthKey, unpaid };
}

async function notifySalaryDue(monthKey, count) {
  const key = `hr_salary_alert_${monthKey}`;
  try {
    if (await settings.get(key)) return;
    const notificationService = require("./notificationService");
    await notificationService.notifyAdmins({
      type: "SALARY_DUE",
      title: "Salaires à payer",
      body: `Le 26 est passé. ${count} salaire(s) de ${monthKey} ne sont pas encore payés.`,
      link: "/admin/rh/paie"
    });
    await settings.set(key, "sent");
  } catch (error) {
    const logger = require("../logger");
    logger.warn("Rappel de paie impossible", { message: error.message });
  }
}

async function paySalary(body) {
  const context = await monthContext(body.month);
  const staff = context.staff.find((row) => row.id === body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const employee = employeeDto(staff, context);
  if (employee.payment) throw fail("Ce salaire est déjà payé pour ce mois.");
  const amount = payableOf(employee);
  if (amount <= 0) throw fail("Ce salaire est à zéro, il n'y a rien à payer.");
  const paidOn = paymentDate(body.paidOn) || tunisToday();
  try {
    await payrollRepo.insertSalaryPayment({ userId: body.userId, month: context.parts.start, amount, paidOn });
  } catch (error) {
    if (error.code === "23505") throw fail("Ce salaire est déjà payé pour ce mois.");
    throw error;
  }
  return overview({ month: context.parts.key });
}

async function cancelSalaryPayment(id) {
  const row = await payrollRepo.findSalaryPayment(id);
  if (!row) throw fail("Paiement introuvable.", 404);
  await payrollRepo.deleteSalaryPayment(id);
  return overview({ month: String(row.month).slice(0, 7) });
}

async function setIncludedCommission(body) {
  const parts = monthParts(body.month);
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (await payrollRepo.findPayslip(body.userId, parts.start)) throw fail("Rouvrez la fiche avant de modifier les commissions.");
  const earning = await payrollRepo.findCommissionEarning(body.earningId);
  if (!earning || earning.user_id !== body.userId) throw fail("Commission introuvable.", 404);
  if (!earning.payout_id) throw fail("Seule une commission déjà payée peut entrer dans la fiche.");
  if (body.include) await payrollRepo.includeCommission(body.userId, parts.start, earning.id);
  else await payrollRepo.excludeCommission(body.userId, parts.start, earning.id);
  return { ok: true };
}

async function saveAdjustment(body) {
  const parts = monthParts(body.month);
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (await payrollRepo.findPayslip(body.userId, parts.start)) throw fail("Rouvrez la fiche avant de modifier la prime ou l'avance.");
  const note = String(body.note || "").trim().slice(0, 300);
  await payrollRepo.saveAdjustment(body.userId, parts.start, { bonus: 0, advance: 0, note });
  return { ok: true };
}

async function addEntry(body) {
  const parts = monthParts(body.month);
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (await payrollRepo.findPayslip(body.userId, parts.start)) throw fail("Rouvrez la fiche avant de modifier la prime ou l'avance.");
  const kind = String(body.kind || "");
  if (!["BONUS", "ADVANCE", "RECOVERY"].includes(kind)) throw fail("Type de ligne invalide.");
  const label = String(body.label || "").trim();
  if (!label || label.length > 160) throw fail("Le libellé est obligatoire (160 caractères maximum).");
  const amount = money(body.amount);
  if (amount <= 0) throw fail("Le montant doit être supérieur à zéro.");
  if (kind === "RECOVERY") {
    const entries = await payrollRepo.listEntries();
    const account = advanceAccount(entries.filter((entry) => entry.user_id === body.userId), parts.start);
    if (account.advanceCarried <= 0) throw fail("L'avance de ce mois est déjà retirée du net. Il n'y a pas d'avance antérieure à retenir.");
    const context = await monthContext(body.month);
    const person = context.staff.find((row) => row.id === body.userId);
    const preview = previewFor(person, context);
    const cap = Math.min(account.advanceCarried, preview.advanceCap);
    if (account.advance + amount > cap + 0.0001) throw fail("La retenue dépasse le dixième du salaire dû.");
  }
  const created = await payrollRepo.insertEntry({ userId: body.userId, month: parts.start, kind, label, amount });
  return { id: created.id, kind: created.kind, label: created.label, amount: num(created.amount) };
}

async function removeEntry(id) {
  const entry = await payrollRepo.findEntry(id);
  if (!entry) throw fail("Ligne introuvable.", 404);
  if (await payrollRepo.findPayslip(entry.user_id, String(entry.month).slice(0, 10))) throw fail("Rouvrez la fiche avant de modifier la prime ou l'avance.");
  await payrollRepo.deleteEntry(id);
  return { ok: true };
}

async function issue(auth, body) {
  const context = await monthContext(body.month);
  const staff = context.staff.find((row) => row.id === body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (context.slips.some((slip) => slip.user_id === body.userId)) throw fail("Cette fiche est déjà émise.");
  const lines = previewFor(staff, context);
  const adjustment = context.adjustments.find((item) => item.user_id === body.userId);
  await payrollRepo.insertPayslip({
    userId: body.userId,
    month: context.parts.start,
    ...lines,
    note: adjustment?.note || "",
    issuedBy: auth.sub,
    advanceBalance: lines.advanceBalance
  });
  return { ok: true };
}

async function reopen(body) {
  const parts = monthParts(body.month);
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  await payrollRepo.clearReportedCommissions(body.userId, parts.start);
  await payrollRepo.deletePayslip(body.userId, parts.start);
  return { ok: true };
}

async function reportUnpaidCommissions(userId, monthValue) {
  const parts = monthParts(monthValue);
  const work = await settings.getWorkHoursConfig();
  const timeZone = work.timezone || "Africa/Tunis";
  await payrollRepo.reportUnpaidCommissions(userId, nextMonth(parts.year, parts.month), timeZone, parts.start);
}

async function loadIssued(userId, monthValue) {
  const context = await monthContext(monthValue);
  const staff = context.staff.find((row) => row.id === userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (!context.slips.some((slip) => slip.user_id === userId)) throw fail("Émettez la fiche avant de la télécharger.");
  const person = employeeDto(staff, context);
  const brand = await brandingFiles();
  return {
    month: context.parts.key,
    prenom: person.prenom,
    nom: person.nom,
    cin: person.cin,
    cnss: person.cnssNumber,
    hiredOn: person.hiredOn,
    jobTitle: jobTitleOf(staff),
    contractType: person.contractType || "",
    absenceDays: person.absenceDays,
    latenessMinutes: person.latenessMinutes,
    lines: person.lines,
    note: person.note,
    signaturePath: brand.signature,
    stampPath: brand.stamp
  };
}

async function attestation(userId, type) {
  const staff = await hrRepo.findStaff(userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (!staff.hired_on) throw fail("Renseignez la date d'embauche avant l'attestation.");
  if (type === "salary" && (staff.base_salary === null || staff.base_salary === undefined)) throw fail("Renseignez le salaire de base avant l'attestation.");
  if (type === "end" && staff.contract_type === "CDI") throw fail("Un CDI est à durée indéterminée : il n'y a pas d'attestation de fin de contrat.");
  if (type === "end" && !staff.contract_ends_on) throw fail("Renseignez la fin de contrat avant l'attestation.");
  if (!["work", "salary", "end"].includes(type)) throw fail("Type d'attestation invalide.");
  const brand = await brandingFiles();
  return {
    type,
    prenom: staff.prenom,
    nom: staff.nom,
    cin: staff.cin || "",
    contractType: staff.contract_type || "",
    hiredOn: staff.hired_on,
    contractEndsOn: staff.contract_ends_on,
    baseSalary: staff.base_salary === null || staff.base_salary === undefined ? null : Number(staff.base_salary),
    roles: rolesOf(staff),
    jobTitle: jobTitleOf(staff),
    signaturePath: brand.signature,
    stampPath: brand.stamp
  };
}

async function myPayslips(userId) {
  const [rows, officialRows] = await Promise.all([
    payrollRepo.listPayslipsFor(userId),
    payrollRepo.listOfficialForUser(userId)
  ]);
  const byMonth = new Map();
  for (const row of rows) {
    const month = String(row.month).slice(0, 7);
    byMonth.set(month, { month, net: num(row.net), issuedAt: row.issued_at, official: false, bulletin: null });
  }
  for (const row of officialRows) {
    const bulletin = payslipImport.officialOf(row);
    byMonth.set(bulletin.month, { month: bulletin.month, net: bulletin.netToPay, issuedAt: row.confirmed_at, official: true, bulletin });
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

async function loadAccountant(userId, monthValue) {
  const context = await monthContext(monthValue);
  const staff = context.staff.find((row) => row.id === userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const person = employeeDto(staff, context);
  const brand = await brandingFiles();
  return { ...person, month: context.parts.key, signaturePath: brand.signature, stampPath: brand.stamp };
}

async function loadFiches(userId, monthValues) {
  const months = [...new Set((Array.isArray(monthValues) ? monthValues : []).map((value) => String(value || "").slice(0, 7)))]
    .filter((value) => /^\d{4}-\d{2}$/.test(value))
    .sort();
  if (!months.length) throw fail("Choisis au moins un mois.");
  if (months.length > 12) throw fail("Douze mois maximum dans un même PDF.");
  const pages = [];
  for (const month of months) {
    const official = await payrollRepo.findOfficial(userId, `${month}-01`);
    if (official) pages.push({ kind: "bulletin", ...(await loadBulletin(userId, month)) });
    else pages.push({ kind: "calculated", ...(await loadAccountant(userId, month)) });
  }
  return pages;
}

async function loadBulletin(userId, monthValue) {
  const parts = monthParts(monthValue);
  const [row, staff, brand] = await Promise.all([
    payrollRepo.findOfficial(userId, parts.start),
    hrRepo.findStaff(userId),
    brandingFiles()
  ]);
  if (!staff) throw fail("Employé introuvable.", 404);
  if (!row) throw fail("Cette fiche n'est pas encore enregistrée.", 404);
  return {
    month: parts.key,
    prenom: staff.prenom,
    nom: staff.nom,
    cin: staff.cin || "",
    cnss: row.cnss_number || staff.cnss_number || "",
    matricule: row.matricule || "",
    hiredOn: staff.hired_on || "",
    jobTitle: jobTitleOf(staff),
    contractType: staff.contract_type || "",
    bulletin: payslipImport.officialOf(row),
    signaturePath: brand.signature,
    stampPath: brand.stamp
  };
}

async function branding() {
  const brand = await brandingFiles();
  return { hasSignature: brand.hasSignature, hasStamp: brand.hasStamp };
}

async function saveBrandFile(kind, fileBase64) {
  if (kind !== "signature" && kind !== "stamp") throw fail("Fichier inconnu.");
  const decoded = decodeFile(fileBase64, ["image/png", "image/jpeg", "image/jpg"]);
  const previous = await settings.get(kind === "signature" ? "hr_signature_file" : "hr_stamp_file");
  const stored = storeFile(kind, decoded.mimeType === "image/png" ? "image/png" : "image/jpeg", decoded.buffer);
  await settings.set(kind === "signature" ? "hr_signature_file" : "hr_stamp_file", stored);
  removeFile(previous);
  return branding();
}

function brandFile(kind, brand) {
  const absolute = kind === "signature" ? brand.signature : brand.stamp;
  if (!absolute) throw fail("Ce fichier n'est pas encore déposé.", 404);
  return { absolutePath: absolute, mimeType: absolute.endsWith(".png") ? "image/png" : "image/jpeg" };
}

async function readBrand(kind) {
  if (kind !== "signature" && kind !== "stamp") throw fail("Fichier inconnu.", 404);
  return brandFile(kind, await brandingFiles());
}

function documentDto(row) {
  return {
    id: row.id,
    label: row.label,
    originalFilename: row.original_filename,
    createdAt: row.created_at,
    kind: row.kind || "OTHER"
  };
}

async function addDocument(userId, body) {
  const staff = await hrRepo.findStaff(userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const kind = body.kind === "CIN" || body.kind === "CONTRACT" ? body.kind : "OTHER";
  const label = kind === "CIN" ? "Copie de la CIN" : kind === "CONTRACT" ? "Contrat de travail" : String(body.label || "").trim();
  if (!label || label.length > 160) throw fail("Le nom du document est obligatoire (160 caractères maximum).");
  const decoded = decodeFile(body.file, ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"]);
  const original = String(body.filename || "document").replace(/[^\w.\- ]+/g, "").slice(0, 180) || "document";
  if (kind !== "OTHER") {
    const previous = await payrollRepo.findDocumentByKind(userId, kind);
    if (previous) {
      await payrollRepo.deleteDocument(previous.id);
      removeFile(previous.stored_filename);
    }
  }
  const stored = storeFile(`doc_${userId.slice(0, 8)}`, decoded.mimeType, decoded.buffer);
  let created;
  try {
    created = await payrollRepo.insertDocument({
      userId,
      label,
      storedFilename: stored,
      originalFilename: original,
      mimeType: decoded.mimeType,
      kind
    });
  } catch (error) {
    removeFile(stored);
    if (error.code === "23505") throw fail("Ce document est déjà déposé. Réessayez.");
    throw error;
  }
  return documentDto(created);
}

async function dossier(userId) {
  const staff = await hrRepo.findStaff(userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const documents = await payrollRepo.listDocuments(userId);
  const identity = (kind) => {
    const row = documents.find((document) => document.kind === kind);
    return row ? documentDto(row) : null;
  };
  const ready = Boolean(staff.hired_on && staff.contract_type);
  if (!ready) return { ready: false, cin: identity("CIN"), contract: identity("CONTRACT") };

  const [profile, slips, totals, commissions, settlements, officialRows] = await Promise.all([
    leaveService.mine(userId),
    payrollRepo.listPayslipHistory(userId),
    payrollRepo.commissionTotals(userId),
    payrollRepo.listCommissionsFor(userId),
    hrRepo.listSettlements(),
    payrollRepo.listOfficialForUser(userId)
  ]);
  const money = (value) => Number(value) || 0;
  return {
    ready: true,
    cin: identity("CIN"),
    contract: identity("CONTRACT"),
    leave: {
      year: profile.year,
      monthlyLeave: profile.monthlyLeave,
      dayValue: profile.dayValue,
      balance: profile.balance,
      openYears: profile.openYears,
      settlements: settlements
        .filter((row) => row.user_id === userId)
        .map((row) => ({
          year: Number(row.year),
          action: row.action,
          days: Number(row.days),
          amount: row.amount === null || row.amount === undefined ? null : Number(row.amount)
        })),
      requests: profile.requests
    },
    payslips: (() => {
      const byMonth = new Map(slips.map((row) => {
        const month = String(row.month).slice(0, 7);
        return [month, {
          month,
          baseSalary: money(row.base_salary),
          commissions: money(row.commissions),
          bonus: money(row.bonus),
          paidLeave: money(row.paid_leave),
          absenceDeduction: money(row.absence_deduction),
          latenessDeduction: money(row.lateness_deduction),
          unpaidHolidayDeduction: money(row.unpaid_holiday_deduction),
          advance: money(row.advance),
          net: money(row.net),
          issuedAt: row.issued_at,
          official: false
        }];
      }));
      for (const row of officialRows) {
        const bulletin = payslipImport.officialOf(row);
        byMonth.set(bulletin.month, {
          month: bulletin.month,
          baseSalary: bulletin.baseSalary,
          commissions: 0,
          bonus: bulletin.transport + bulletin.presenceBonus + bulletin.functionAllowance + bulletin.responsibilityBonus,
          paidLeave: bulletin.leaveAmount,
          absenceDeduction: 0,
          latenessDeduction: 0,
          unpaidHolidayDeduction: 0,
          advance: 0,
          net: bulletin.netToPay,
          issuedAt: row.confirmed_at,
          official: true
        });
      }
      return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
    })(),
    commissions: {
      total: money(totals.total),
      paid: money(totals.paid),
      pending: Math.round((money(totals.total) - money(totals.paid)) * 1000) / 1000,
      rows: commissions.map((row) => ({
        id: row.id,
        earnedAt: row.earned_at,
        student: `${row.student_prenom} ${row.student_nom}`.trim(),
        country: row.country || "",
        stage: row.stage,
        amount: money(row.amount_dinar),
        paid: row.paid === true
      }))
    }
  };
}

async function openDocument(id, userId) {
  const document = await payrollRepo.findDocument(id);
  if (!document) throw fail("Document introuvable.", 404);
  if (userId && document.user_id !== userId) throw fail("Vous n'avez pas accès à ce document.", 403);
  const absolutePath = path.join(HR_DIR, path.basename(document.stored_filename));
  if (!fs.existsSync(absolutePath)) throw fail("Le fichier n'existe plus sur le serveur.", 404);
  return { absolutePath, mimeType: document.mime_type, originalFilename: document.original_filename };
}

async function myDocuments(userId) {
  const rows = await payrollRepo.listDocuments(userId);
  return rows.map((document) => ({
    id: document.id,
    label: document.label,
    originalFilename: document.original_filename,
    createdAt: document.created_at
  }));
}

async function removeDocument(id) {
  const removed = await payrollRepo.deleteDocument(id);
  if (!removed) throw fail("Document introuvable.", 404);
  removeFile(removed.stored_filename);
  return { ok: true };
}

const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function tunisToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function labelMonth(value) {
  const [year, month] = String(value || "").slice(0, 7).split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : String(value || "").slice(0, 7);
}

function labelDate(value) {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

function requestDto(row) {
  return {
    id: row.id,
    userId: row.user_id,
    prenom: row.prenom,
    nom: row.nom,
    kind: row.kind,
    month: row.month ? String(row.month).slice(0, 7) : null,
    status: row.status,
    readyOn: row.ready_on ? String(row.ready_on).slice(0, 10) : null,
    hasFiche: row.has_fiche === true
  };
}

async function myDocumentRequests(userId) {
  const rows = await payrollRepo.listDocumentRequests(userId);
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    month: row.month ? String(row.month).slice(0, 7) : null,
    status: row.status,
    readyOn: row.ready_on ? String(row.ready_on).slice(0, 10) : null
  }));
}

async function payslipExists(userId, month) {
  return Boolean((await payrollRepo.findPayslip(userId, month)) || (await payrollRepo.findOfficial(userId, month)));
}

async function requestPayslipMonths(auth, staff, rawMonths) {
  const months = [...new Set((Array.isArray(rawMonths) ? rawMonths : []).map((value) => String(value || "").slice(0, 7)))]
    .filter((value) => /^\d{4}-\d{2}$/.test(value))
    .sort();
  if (!months.length) throw fail("Choisis au moins un mois.");
  if (months.length > 12) throw fail("Douze mois maximum.");
  const created = [];
  const missing = [];
  for (const key of months) {
    const start = `${key}-01`;
    const current = await payrollRepo.findDocumentRequest(auth.sub, "PAYSLIP", start);
    if (current?.status === "PENDING" || current?.status === "APPROVED") continue;
    try {
      const row = await payrollRepo.insertDocumentRequest(auth.sub, "PAYSLIP", start);
      created.push(row);
      if (!(await payslipExists(auth.sub, start))) missing.push(key);
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
  }
  if (!created.length) throw fail("Ces mois sont déjà demandés ou validés.");
  const name = `${staff.prenom} ${staff.nom}`.trim();
  const labels = created.map((row) => labelMonth(row.month)).join(", ");
  const missingText = missing.length ? ` Sans fiche pour l'instant : ${missing.map(labelMonth).join(", ")}.` : "";
  const notifications = require("./notificationService");
  await notifications.notifyAdmins({
    type: "HR_DOCUMENT_REQUEST",
    title: "Demande de fiche de paie",
    body: `${name} demande la fiche de paie de ${labels}.${missingText}`,
    link: "/admin/rh/paie"
  });
  return created.map((row) => ({
    id: row.id,
    kind: row.kind,
    month: row.month ? String(row.month).slice(0, 7) : null,
    status: row.status,
    readyOn: null
  }));
}

async function requestDocument(auth, body) {
  const kind = String(body.kind || "");
  if (!["WORK", "PAYSLIP"].includes(kind)) throw fail("Type de demande invalide.");
  const staff = await hrRepo.findStaff(auth.sub);
  if (!staff) throw fail("Fiche employé introuvable.", 404);
  if (kind === "PAYSLIP" && Array.isArray(body.months)) return requestPayslipMonths(auth, staff, body.months);
  let month = null;
  if (kind === "WORK") {
    if (!staff.hired_on) throw fail("La fiche n'a pas encore de date d'embauche.");
  } else {
    const parts = monthParts(body.month);
    month = parts.start;
  }
  const current = await payrollRepo.findDocumentRequest(auth.sub, kind, month);
  if (current?.status === "PENDING") throw fail("Une demande est déjà en attente.");
  if (current?.status === "APPROVED") throw fail("Ce document est déjà validé. Vous pouvez le télécharger.");
  let created;
  try {
    created = await payrollRepo.insertDocumentRequest(auth.sub, kind, month);
  } catch (error) {
    if (error.code === "23505") throw fail("Une demande est déjà en attente.");
    throw error;
  }
  const name = `${staff.prenom} ${staff.nom}`.trim();
  const missing = kind === "PAYSLIP" && !(await payslipExists(auth.sub, month));
  const label = kind === "WORK" ? "une attestation de travail" : `la fiche de paie de ${labelMonth(month)}`;
  const notifications = require("./notificationService");
  await notifications.notifyAdmins({
    type: "HR_DOCUMENT_REQUEST",
    title: kind === "WORK" ? "Demande d'attestation de travail" : "Demande de fiche de paie",
    body: missing ? `${name} demande ${label}. Ce mois n'a pas encore de fiche de paie.` : `${name} demande ${label}.`,
    link: "/admin/rh/paie"
  });
  return { id: created.id, kind: created.kind, month: created.month ? String(created.month).slice(0, 7) : null, status: created.status, readyOn: null };
}

async function listDocumentRequests() {
  const rows = await payrollRepo.listPendingDocumentRequests();
  return rows.map(requestDto);
}

async function scheduleDocumentRequest(id, body) {
  const readyOn = String(body.readyOn || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readyOn)) throw fail("Date invalide.");
  if (readyOn < tunisToday()) throw fail("Choisis aujourd'hui ou une date à venir.");
  const updated = await payrollRepo.scheduleDocumentRequest(id, readyOn);
  if (!updated) throw fail("Demande introuvable ou déjà traitée.", 404);
  const notifications = require("./notificationService");
  await notifications.notify(updated.user_id, {
    type: "HR_DOCUMENT_READY",
    title: "Date de la fiche de paie",
    body: `Votre fiche de paie de ${labelMonth(updated.month)} sera prête le ${labelDate(readyOn)}. La demande reste ouverte.`,
    link: "/rh"
  });
  return { id: updated.id, status: updated.status, readyOn };
}

async function decideDocumentRequest(auth, id, body) {
  if (body.readyOn) return scheduleDocumentRequest(id, body);
  const status = String(body.status || "");
  if (!["APPROVED", "REJECTED"].includes(status)) throw fail("Décision invalide.");
  const current = await payrollRepo.findDocumentRequestById(id);
  if (!current || current.status !== "PENDING") throw fail("Demande introuvable ou déjà traitée.", 404);
  if (status === "APPROVED" && current.kind === "PAYSLIP" && !(await payslipExists(current.user_id, String(current.month).slice(0, 10)))) {
    throw fail("Ce mois n'a pas encore de fiche de paie.");
  }
  const decided = await payrollRepo.decideDocumentRequest(id, status, auth.sub);
  if (!decided) throw fail("Demande introuvable ou déjà traitée.", 404);
  const label = decided.kind === "WORK" ? "Votre attestation de travail" : `Votre fiche de paie de ${labelMonth(decided.month)}`;
  const notifications = require("./notificationService");
  await notifications.notify(decided.user_id, {
    type: "HR_DOCUMENT_READY",
    title: status === "APPROVED" ? "Document validé" : "Document refusé",
    body: status === "APPROVED" ? `${label} est prête à télécharger.` : `${label} a été refusée.`,
    link: "/rh"
  });
  return { id: decided.id, status: decided.status };
}

async function remindDuePayslips() {
  const rows = await payrollRepo.listDuePayslipRequests(tunisToday());
  const notifications = require("./notificationService");
  for (const row of rows) {
    const name = `${row.prenom} ${row.nom}`.trim();
    await notifications.notifyAdmins({
      type: "HR_PAYSLIP_DUE",
      title: "Fiche de paie à préparer",
      body: row.has_fiche
        ? `La fiche de paie de ${labelMonth(row.month)} demandée par ${name} devait être prête aujourd'hui.`
        : `La fiche de paie de ${labelMonth(row.month)} demandée par ${name} devait être prête aujourd'hui. Ce mois n'a pas encore de fiche de paie.`,
      link: "/admin/rh/paie"
    });
    await payrollRepo.markPayslipReminded(row.id);
  }
}

async function assertEmployeeDownload(userId, kind, rawMonth) {
  const month = kind === "PAYSLIP" ? monthParts(rawMonth).start : null;
  const request = await payrollRepo.findDocumentRequest(userId, kind, month);
  if (request?.status !== "APPROVED") throw fail("Ce document n'est pas encore validé.", 403);
}

module.exports = {
  overview,
  paySalary,
  cancelSalaryPayment,
  saveAdjustment,
  setIncludedCommission,
  issue,
  reopen,
  loadIssued,
  reportUnpaidCommissions,
  loadAccountant,
  loadBulletin,
  loadFiches,
  attestation,
  myPayslips,
  branding,
  saveBrandFile,
  readBrand,
  addDocument,
  dossier,
  openDocument,
  removeDocument,
  addEntry,
  removeEntry,
  myDocumentRequests,
  requestDocument,
  listDocumentRequests,
  decideDocumentRequest,
  remindDuePayslips,
  assertEmployeeDownload,
  myDocuments
};
