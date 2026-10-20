const hrRepo = require("../repositories/hrRepository");
const settings = require("../repositories/settingsRepository");
const { monthlyLeave, getSettings } = require("./hrService");
const leaveCovers = require("./hrLeaveCoverService");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const round2 = (value) => Math.round(value * 100) / 100;
const round3 = (value) => Math.round(value * 1000) / 1000;

function parseDay(iso) {
  const [year, month, day] = String(iso).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoOf(date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date());
}

function weekday(date) {
  const js = date.getUTCDay();
  return js === 0 ? 7 : js;
}

function addDays(iso, days) {
  const date = parseDay(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoOf(date);
}

function wholeJours(value) {
  const n = Math.max(0, Math.floor(Number(value) || 0));
  return `${n} jour${n > 1 ? "s" : ""}`;
}

function leaveNoticeBlock(today, startOn, days, factor) {
  const notice = days * factor;
  if (!factor || notice <= 0) return null;
  const latest = addDays(startOn, -notice);
  if (today <= latest) return null;
  const missing = Math.round((parseDay(today) - parseDay(latest)) / 86400000);
  const limit = new Date(`${latest}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" });
  return `Cette demande doit être déposée au plus tard le ${limit}, soit ${wholeJours(notice)} avant le début. Il manque ${wholeJours(missing)}. Elle n'a pas été enregistrée.`;
}

function cleanDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw fail("Date invalide.");
  return text;
}

// Seuls les jours ouvrés retirent du solde. Le week-end ne compte pas.
// Un férié payé, même en semaine, ne compte pas. Un férié impayé ouvré compte.
function explainLeave(startOn, endOn, workDays, holidays) {
  const start = parseDay(startOn).getTime();
  const end = parseDay(endOn).getTime();
  if (end < start) throw fail("La fin est avant le début.");
  const paid = new Set(
    (holidays || [])
      .filter((row) => row && row.paid !== false && row.day)
      .map((row) => String(row.day).slice(0, 10))
  );
  let total = 0;
  for (let time = start; time <= end; time += 86400000) {
    const date = new Date(time);
    if (workDays.has(weekday(date)) && !paid.has(isoOf(date))) total += 1;
  }
  if (total <= 0) throw fail("Cette période ne contient aucun jour ouvré.");
  return { working: total, extra: 0, total, weekendAfterFriday: false, coveredEnd: endOn };
}

// Un mois crédite ses jours seulement une fois terminé. Le mois en cours reste à 0 jusqu'au lendemain de son dernier jour.
// switchOn : le CIVP (1,5) devient CDI (2) ce jour-là. Un mois commencé en cours de route reste proportionnel, mais seulement après sa fin.
function accrue(hiredOn, endsOn, year, rate, untilIso, switchOn) {
  if (!hiredOn || !rate) return 0;
  const hired = parseDay(hiredOn).getTime();
  const endContract = endsOn ? parseDay(endsOn).getTime() : Infinity;
  const switchTime = switchOn ? parseDay(switchOn).getTime() : null;
  let total = 0;
  for (let month = 0; month < 12; month += 1) {
    const monthStart = Date.UTC(year, month, 1);
    const last = new Date(Date.UTC(year, month + 1, 0));
    if (isoOf(last) >= untilIso) continue;
    const from = Math.max(monthStart, hired);
    const to = Math.min(last.getTime(), endContract);
    if (from > to) continue;
    const days = last.getUTCDate();
    const portion = (fromTime, toTime, monthRate) => monthRate * (((toTime - fromTime) / 86400000 + 1) / days);
    if (!switchTime || to < switchTime) {
      total += portion(from, to, switchTime ? 1.5 : rate);
    } else if (from >= switchTime) {
      total += portion(from, to, 2);
    } else {
      total += portion(from, switchTime - 86400000, 1.5) + portion(switchTime, to, 2);
    }
  }
  return round2(total);
}

function requestDto(row, covers) {
  return {
    cover: covers ? covers.get(row.id) || [] : undefined,
    id: row.id,
    userId: row.user_id,
    startOn: row.start_on,
    endOn: row.end_on,
    days: Number(row.days),
    coversAbsence: row.covers_absence === true,
    reason: row.reason || "",
    status: row.status,
    createdAt: row.created_at
  };
}

async function context() {
  const [staff, requests, settlements, adjustments, holidays, work, rules, covers] = await Promise.all([
    hrRepo.listStaff(),
    hrRepo.listLeaveRequests(),
    hrRepo.listSettlements(),
    hrRepo.listLeaveAdjustments(),
    hrRepo.listHolidays(),
    settings.getWorkHoursConfig(),
    getSettings(),
    hrRepo.listLeaveRequests().then((rows) => leaveCovers.summaryFor(rows.filter((row) => row.status === "APPROVED").map((row) => row.id)))
  ]);
  return { staff, requests, settlements, adjustments, holidays, work, rules, covers, today: todayIso() };
}

function yearBalance(employee, year, data, untilIso) {
  const rate = monthlyLeave(employee.contract_type, employee.leave_days_per_month);
  const carried = data.settlements.find((row) => row.user_id === employee.id && Number(row.year) === year - 1 && row.action === "CARRY");
  const carry = carried ? Number(carried.days) : 0;
  const accrued = accrue(employee.hired_on, employee.contract_ends_on, year, rate, untilIso, employee.cdi_from || null);
  const used = data.requests
    .filter((row) => row.user_id === employee.id && row.status === "APPROVED" && Number(row.start_on.slice(0, 4)) === year)
    .reduce((sum, row) => sum + Number(row.days), 0);
  const given = data.adjustments.find((row) => row.user_id === employee.id && Number(row.year) === year);
  const manual = given ? round2(Number(given.days)) : 0;
  return { carry: round2(carry), accrued, manual, used: round2(used), remaining: round2(carry + accrued + manual - used) };
}

function openYears(employee, data) {
  if (!employee.hired_on || !employee.contract_type) return [];
  const first = Number(employee.hired_on.slice(0, 4));
  const current = Number(data.today.slice(0, 4));
  const years = [];
  for (let year = first; year < current; year += 1) {
    if (data.settlements.some((row) => row.user_id === employee.id && Number(row.year) === year)) continue;
    const balance = yearBalance(employee, year, data, `${year + 1}-01-01`);
    if (balance.accrued === 0 && balance.carry === 0 && balance.used === 0) continue;
    years.push({ year, ...balance });
  }
  return years;
}

function employeeLeave(employee, data) {
  const year = Number(data.today.slice(0, 4));
  const rate = monthlyLeave(employee.contract_type, employee.leave_days_per_month);
  const balance = employee.contract_type ? yearBalance(employee, year, data, data.today) : null;
  const dayValue = employee.base_salary && data.rules.dayDivisor ? round3(Number(employee.base_salary) / data.rules.dayDivisor) : null;
  return {
    id: employee.id,
    prenom: employee.prenom,
    nom: employee.nom,
    contractType: employee.contract_type,
    contractEndsOn: employee.contract_ends_on || null,
    baseSalary: employee.base_salary === null || employee.base_salary === undefined ? null : Number(employee.base_salary),
    monthlyLeave: rate,
    dayValue,
    year,
    balance,
    openYears: openYears(employee, data),
    requests: data.requests.filter((row) => row.user_id === employee.id).map((row) => requestDto(row, data.covers)),
    leaveNoticeFactor: data.rules.leaveNoticeFactor
  };
}

async function overview() {
  const data = await context();
  return data.staff.map((employee) => employeeLeave(employee, data));
}

async function mine(userId) {
  const data = await context();
  const employee = data.staff.find((row) => row.id === userId);
  if (!employee) throw fail("Fiche employé introuvable.", 404);
  return employeeLeave(employee, data);
}

async function previewRequest(auth, body) {
  const data = await context();
  const employee = data.staff.find((row) => row.id === auth.sub);
  if (!employee) throw fail("Employé introuvable.", 404);
  if (!employee.contract_type || !employee.hired_on) throw fail("Renseignez d'abord le contrat et la date d'embauche.");
  const startOn = cleanDate(body.startOn);
  const endOn = cleanDate(body.endOn);
  const explained = explainLeave(startOn, endOn, await workDaySet(data.work), data.holidays);
  const year = Number(startOn.slice(0, 4));
  const balance = yearBalance(employee, year, data, data.today);
  const factor = data.rules.leaveNoticeFactor;
  const noticeDays = explained.total * factor;
  const earliestStart = factor > 0 ? addDays(data.today, noticeDays) : null;
  return {
    working: explained.working,
    extra: explained.extra,
    total: explained.total,
    weekendAfterFriday: explained.weekendAfterFriday,
    coveredEnd: explained.coveredEnd,
    factor,
    noticeDays,
    earliestStart,
    noticeOk: !leaveNoticeBlock(data.today, startOn, explained.total, factor),
    remaining: balance.remaining,
    enough: balance.remaining >= explained.total
  };
}

async function workDaySet(work) {
  return new Set(String(work.days).split(",").map((day) => parseInt(day, 10)).filter((day) => day >= 1 && day <= 7));
}

async function createRequest(auth, body, { forSelf }) {
  const userId = forSelf ? auth.sub : body.userId;
  const data = await context();
  const employee = data.staff.find((row) => row.id === userId);
  if (!employee) throw fail("Employé introuvable.", 404);
  if (!employee.contract_type || !employee.hired_on) throw fail("Renseignez d'abord le contrat et la date d'embauche.");

  const startOn = cleanDate(body.startOn);
  const endOn = cleanDate(body.endOn);
  const explained = explainLeave(startOn, endOn, await workDaySet(data.work), data.holidays);
  const days = explained.total;
  if (await hrRepo.hasApprovedOverlap(userId, startOn, explained.coveredEnd, null)) throw fail("Un congé est déjà accepté sur ces dates.");

  const year = Number(startOn.slice(0, 4));
  const balance = yearBalance(employee, year, data, data.today);
  if (balance.remaining < days) {
    const text = forSelf
      ? `Solde insuffisant : ${wholeJours(balance.remaining)} disponible${Math.floor(balance.remaining) > 1 ? "s" : ""}, ${wholeJours(days)} demandé${days > 1 ? "s" : ""}.`
      : `Solde insuffisant : ${round2(balance.remaining).toFixed(2)} jour(s) disponible(s), ${days} demandé(s).`;
    throw fail(text);
  }

  if (forSelf) {
    const blocked = leaveNoticeBlock(data.today, startOn, days, data.rules.leaveNoticeFactor);
    if (blocked) throw fail(blocked);
  }

  const approveNow = !forSelf && body.approveNow === true;
  // Accepté tout de suite par l'admin : remplaçants vérifiés avant d'enregistrer quoi que ce soit.
  let plan = null;
  if (approveNow) {
    await leaveCovers.assertNotCovering(userId, startOn, explained.coveredEnd);
    plan = await leaveCovers.preparePlan({ userId, startOn, endOn: explained.coveredEnd, leaveId: null, cover: body.cover });
  }
  const id = await hrRepo.insertLeaveRequest({
    userId,
    startOn,
    endOn: explained.coveredEnd,
    days,
    coversAbsence: forSelf ? false : body.coversAbsence === true,
    reason: String(body.reason || "").trim().slice(0, 500) || null,
    status: approveNow ? "APPROVED" : "PENDING",
    decidedBy: approveNow ? auth.sub : null,
    decidedAt: approveNow ? new Date() : null
  });
  if (plan) await leaveCovers.saveForApprovedLeave({ leaveId: id, userId, startOn, endOn: explained.coveredEnd, plan, by: auth.sub });
  const created = await hrRepo.findLeaveRequest(id);
  return requestDto(created);
}

async function decide(auth, id, body) {
  const status = body.status === "APPROVED" ? "APPROVED" : body.status === "REJECTED" ? "REJECTED" : "";
  if (!status) throw fail("Décision invalide.");
  const request = await hrRepo.findLeaveRequest(id);
  if (!request) throw fail("Demande introuvable.", 404);
  if (request.status !== "PENDING") throw fail("Cette demande est déjà tranchée.");

  let plan = null;
  if (status === "APPROVED") {
    const data = await context();
    const employee = data.staff.find((row) => row.id === request.user_id);
    if (!employee) throw fail("Employé introuvable.", 404);
    if (await hrRepo.hasApprovedOverlap(request.user_id, request.start_on, request.end_on, request.id)) {
      throw fail("Un congé est déjà accepté sur ces dates.");
    }
    const year = Number(request.start_on.slice(0, 4));
    const balance = yearBalance(employee, year, data, data.today);
    if (balance.remaining < Number(request.days)) {
      throw fail(`Solde insuffisant : ${round2(balance.remaining).toFixed(2)} jour(s) disponible(s).`);
    }
    // Conseiller / Responsable Dossier : ses dossiers et conversations sont confiés aux remplaçants choisis.
    await leaveCovers.assertNotCovering(request.user_id, request.start_on, request.end_on);
    plan = await leaveCovers.preparePlan({ userId: request.user_id, startOn: request.start_on, endOn: request.end_on, leaveId: request.id, cover: body.cover });
  }
  await hrRepo.setLeaveStatus(id, status, auth.sub);
  if (plan) await leaveCovers.saveForApprovedLeave({ leaveId: id, userId: request.user_id, startOn: request.start_on, endOn: request.end_on, plan, by: auth.sub });
  return requestDto(await hrRepo.findLeaveRequest(id));
}

async function settle(auth, body) {
  const action = body.action === "CARRY" ? "CARRY" : body.action === "PAY" ? "PAY" : "";
  if (!action) throw fail("Choisissez le report ou le paiement.");
  const year = parseInt(body.year, 10);
  const data = await context();
  const current = Number(data.today.slice(0, 4));
  if (!Number.isFinite(year) || year >= current) throw fail("Seule une année terminée peut être soldée.");
  const employee = data.staff.find((row) => row.id === body.userId);
  if (!employee) throw fail("Employé introuvable.", 404);
  if (data.settlements.some((row) => row.user_id === employee.id && Number(row.year) === year)) {
    throw fail("Cette année est déjà soldée.");
  }
  const balance = yearBalance(employee, year, data, `${year + 1}-01-01`);
  if (balance.remaining === 0) throw fail("Aucun jour à solder pour cette année.");
  if (action === "PAY" && balance.remaining < 0) throw fail("Le solde est négatif : reportez-le sur l'année suivante.");
  let amount = null;
  if (action === "PAY") {
    const typed = body.amount === null || body.amount === undefined || String(body.amount).trim() === "" ? null : Number(String(body.amount).replace(",", "."));
    if (typed !== null) {
      if (!Number.isFinite(typed) || typed < 0) throw fail("Montant invalide.");
      amount = round3(typed);
    } else if (employee.base_salary) {
      amount = round3(balance.remaining * (Number(employee.base_salary) / data.rules.dayDivisor));
    } else {
      throw fail("Pas de salaire de base : indiquez le montant à payer.");
    }
  }
  await hrRepo.insertSettlement({
    userId: employee.id,
    year,
    action,
    days: balance.remaining,
    amount,
    createdBy: auth.sub
  });
  return { year, action, days: balance.remaining, amount };
}

async function setBalance(auth, body) {
  const data = await context();
  const employee = data.staff.find((row) => row.id === body.userId);
  if (!employee) throw fail("Employé introuvable.", 404);
  if (!employee.contract_type || !employee.hired_on) throw fail("Renseignez d'abord le contrat et la date d'embauche.");
  const typed = Number(String(body.days ?? "").replace(",", ".").trim());
  if (!Number.isFinite(typed)) throw fail("Indiquez le solde en jours.");
  const desired = round2(typed);
  if (desired < 0 || desired > 366) throw fail("Indiquez un solde entre 0 et 366 jours.");
  const year = Number(data.today.slice(0, 4));
  const current = yearBalance(employee, year, data, data.today);
  const base = round2(current.carry + current.accrued - current.used);
  const manual = round2(desired - base);
  await hrRepo.upsertLeaveAdjustment({ userId: employee.id, year, days: manual, updatedBy: auth.sub });
  return { year, remaining: desired, manual };
}

async function coverAbsences(auth, body) {
  const userId = String(body.userId || "");
  const raw = Array.isArray(body.days) ? body.days : [];
  const dates = [...new Set(raw.map((day) => cleanDate(day)))].sort();
  if (!dates.length) throw fail("Choisissez au moins un jour d'absence.");
  const attendance = require("./hrAttendanceService");
  const known = new Set((await attendance.absenceDays(userId)).map((row) => row.day));
  if (dates.some((day) => !known.has(day))) throw fail("Un jour choisi n'est pas une absence.");

  const data = await context();
  const employee = data.staff.find((row) => row.id === userId);
  if (!employee) throw fail("Employé introuvable.", 404);
  if (!employee.contract_type || !employee.hired_on) throw fail("Renseignez d'abord le contrat et la date d'embauche.");

  const byYear = new Map();
  for (const day of dates) {
    const year = Number(day.slice(0, 4));
    byYear.set(year, (byYear.get(year) || 0) + 1);
  }
  for (const [year, count] of byYear) {
    const balance = yearBalance(employee, year, data, data.today);
    if (balance.remaining < count) {
      throw fail(`Solde insuffisant : ${round2(balance.remaining).toFixed(2)} jour(s) disponible(s), ${count} demandé(s).`);
    }
  }
  for (const day of dates) {
    if (await hrRepo.hasApprovedOverlap(userId, day, day, null)) throw fail("Un congé est déjà accepté sur ces dates.");
  }

  const reason = String(body.reason || "").trim().slice(0, 500) || "Absence compensée";
  const created = [];
  for (const day of dates) {
    const id = await hrRepo.insertLeaveRequest({
      userId,
      startOn: day,
      endOn: day,
      days: 1,
      coversAbsence: true,
      reason,
      status: "APPROVED",
      decidedBy: auth.sub,
      decidedAt: new Date()
    });
    created.push(requestDto(await hrRepo.findLeaveRequest(id)));
  }
  return created;
}

module.exports = { overview, mine, createRequest, previewRequest, decide, settle, setBalance, coverAbsences, leaveNoticeBlock };
