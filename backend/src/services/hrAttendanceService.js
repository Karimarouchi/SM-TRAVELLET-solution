const hrRepo = require("../repositories/hrRepository");
const attendanceRepo = require("../repositories/hrAttendanceRepository");
const settings = require("../repositories/settingsRepository");
const { getSettings } = require("./hrService");
const { buildMonth, zoned } = require("./attendanceRules");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function minutesOf(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function rolesOf(row) {
  const extra = Array.isArray(row.extra_roles) ? row.extra_roles : [];
  return [...new Set([row.base_role, ...extra])].filter((role) => role && role !== "STUDENT");
}

function monthBounds(year, month, timeZone) {
  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  // Bornes larges : le découpage exact se fait dans le fuseau, au calcul.
  const from = new Date(start.getTime() - 36 * 3600 * 1000);
  const to = new Date(Date.UTC(nextYear, nextMonth - 1, 2, 0, 0, 0));
  return { from, to, monthStart: `${year}-${String(month).padStart(2, "0")}-01`, timeZone };
}

async function monthData(year, month) {
  const work = await settings.getWorkHoursConfig();
  const rules = await getSettings();
  const bounds = monthBounds(year, month, work.timezone);
  const staff = await hrRepo.listStaff();
  const salesIds = staff.filter((row) => rolesOf(row).includes("SALES")).map((row) => row.id);
  const [events, messages, actions, overrides, amounts, holidays, requests] = await Promise.all([
    attendanceRepo.listEvents(bounds.from, bounds.to),
    attendanceRepo.listMessages(salesIds, bounds.from, bounds.to),
    attendanceRepo.listDossierActions(bounds.from, bounds.to),
    attendanceRepo.listOverrides(bounds.monthStart, bounds.to.toISOString().slice(0, 10)),
    attendanceRepo.listAmounts(bounds.monthStart),
    hrRepo.listHolidays(),
    hrRepo.listLeaveRequests()
  ]);
  return { work, rules, bounds, staff, events, messages, actions, overrides, amounts, holidays, requests };
}

function reportFor(row, data, year, month) {
  const roles = rolesOf(row);
  const mode = roles.includes("SALES") ? "sales" : "desk";
  const salary = row.base_salary === null || row.base_salary === undefined ? null : Number(row.base_salary);
  const amountRow = data.amounts.find((item) => item.user_id === row.id);
  const before = data.messages.before
    .filter((message) => message.sales_id === row.id)
    .map((message) => ({ at: message.at, direction: message.direction, auto: false, sentBy: message.sent_by, contactId: message.contact_id }));
  const during = data.messages.during
    .filter((message) => message.sales_id === row.id)
    .map((message) => ({
      at: message.at,
      direction: message.direction,
      auto: message.is_auto === true,
      sentBy: message.sent_by,
      contactId: message.contact_id
    }));
  const now = zoned(new Date(), data.work.timezone);
  const report = buildMonth({
    year,
    month,
    today: now.day,
    nowMin: now.minutes,
    timeZone: data.work.timezone,
    startMin: minutesOf(data.work.start),
    endMin: minutesOf(data.work.end),
    workDays: new Set(String(data.work.days).split(",").map((day) => parseInt(day, 10))),
    mode,
    userId: row.id,
    salary,
    divisor: data.rules.dayDivisor,
    messages: [...before, ...during],
    events: data.events.filter((event) => event.user_id === row.id).map((event) => ({ at: event.at, kind: event.kind })),
    actions: data.actions.filter((action) => action.user_id === row.id).map((action) => ({ at: action.at })),
    leaves: data.requests
      .filter((request) => request.user_id === row.id && request.status === "APPROVED")
      .map((request) => ({ startOn: request.start_on, endOn: request.end_on })),
    holidays: data.holidays,
    overrides: data.overrides
      .filter((item) => item.user_id === row.id)
      .map((item) => ({
        day: item.day,
        waived: item.waived === true,
        lateMinutes: item.late_minutes === null || item.late_minutes === undefined ? null : Number(item.late_minutes),
        earlyMinutes: item.early_minutes === null || item.early_minutes === undefined ? null : Number(item.early_minutes),
        note: item.note || "",
        confirmedAbsent: item.confirmed_absent === true
      })),
    monthAmount: amountRow ? Number(amountRow.amount) : null,
    attendanceSince: data.rules.attendanceSince
  });
  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    roles,
    mode,
    baseSalary: salary,
    ...report
  };
}

async function overview(query) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(query.month || ""));
  if (!match) throw fail("Mois invalide.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw fail("Mois invalide.");
  const data = await monthData(year, month);
  return {
    month: `${match[1]}-${match[2]}`,
    workStart: data.work.start,
    workEnd: data.work.end,
    dayDivisor: data.rules.dayDivisor,
    employees: data.staff.map((row) => reportFor(row, data, year, month))
  };
}

function cleanMinutes(value) {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) throw fail("Minutes invalides.");
  return minutes;
}

async function saveDay(body) {
  const day = String(body.day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw fail("Date invalide.");
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const note = String(body.note || "").trim().slice(0, 300);
  await attendanceRepo.saveOverride(body.userId, day, {
    waived: body.waived === true,
    lateMinutes: cleanMinutes(body.lateMinutes),
    earlyMinutes: cleanMinutes(body.earlyMinutes),
    note,
    confirmedAbsent: body.confirmedAbsent === true
  });
  return { ok: true };
}

async function saveMonthAmount(body) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(body.month || ""));
  if (!match) throw fail("Mois invalide.");
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  let amount = null;
  if (body.amount !== null && body.amount !== undefined && String(body.amount).trim() !== "") {
    amount = Number(String(body.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) throw fail("Montant invalide.");
    amount = Math.round(amount * 1000) / 1000;
  }
  await attendanceRepo.saveAmount(body.userId, `${match[1]}-${match[2]}-01`, amount);
  return { ok: true };
}

async function confirmAbsences(body) {
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const days = [...new Set((Array.isArray(body.days) ? body.days : []).map((day) => String(day)))];
  if (!days.length || days.some((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day))) throw fail("Sélectionnez au moins un jour.");
  const from = days.slice().sort()[0];
  const last = days.slice().sort().at(-1);
  const end = new Date(`${last}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const existing = await attendanceRepo.listOverrides(from, end.toISOString().slice(0, 10));
  for (const day of days) {
    const current = existing.find((row) => row.user_id === body.userId && row.day === day);
    await attendanceRepo.saveOverride(body.userId, day, {
      waived: current?.waived === true && body.absent !== true,
      lateMinutes: current?.late_minutes === null || current?.late_minutes === undefined ? null : Number(current.late_minutes),
      earlyMinutes: current?.early_minutes === null || current?.early_minutes === undefined ? null : Number(current.early_minutes),
      note: current?.note || "",
      confirmedAbsent: body.absent === true
    });
  }
  return { ok: true };
}

async function absenceDays(userId) {
  const staff = await hrRepo.findStaff(userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const rules = await getSettings();
  const work = await settings.getWorkHoursConfig();
  const today = zoned(new Date(), work.timezone).day;
  const since = rules.attendanceSince || `${today.slice(0, 4)}-01-01`;
  const start = since <= today ? since : today;
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endYear = Number(today.slice(0, 4));
  const endMonth = Number(today.slice(5, 7));
  const days = [];
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const data = await monthData(year, month);
    const report = reportFor(staff, data, year, month);
    for (const day of report.days) {
      if (day.status === "ABSENT" || day.status === "NO_REPLY") {
        days.push({ day: day.day, status: day.status, confirmed: day.confirmed === true });
      }
    }
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return days;
}

module.exports = { overview, saveDay, saveMonthAmount, confirmAbsences, absenceDays };
