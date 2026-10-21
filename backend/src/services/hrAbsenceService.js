const fs = require("fs");
const path = require("path");
const hrRepo = require("../repositories/hrRepository");
const absenceRepo = require("../repositories/hrAbsenceRepository");
const settings = require("../repositories/settingsRepository");
const attendance = require("./hrAttendanceService");
const { getSettings } = require("./hrService");
const { deadline, onTime, shouldRemind } = require("./absenceRules");
const notificationService = require("./notificationService");

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
  const next = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? Number(match[1]) + 1 : Number(match[1]);
  return {
    key: `${match[1]}-${match[2]}`,
    start: `${match[1]}-${match[2]}-01`,
    end: `${nextYear}-${String(next).padStart(2, "0")}-01`
  };
}

function minutesOf(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function decodeFile(fileBase64) {
  const match = String(fileBase64 || "").match(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,([\s\S]+)$/);
  if (!match) throw fail("Format de fichier non supporté (image ou PDF).");
  const buffer = Buffer.from(match[3], "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw fail("Le fichier est invalide ou dépasse 3 Mo.");
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  return { mimeType, buffer };
}

function storeFile(userId, mimeType, buffer) {
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  fs.mkdirSync(HR_DIR, { recursive: true });
  const storedFilename = `cert_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(HR_DIR, storedFilename), buffer);
  return storedFilename;
}

function removeFile(filename) {
  if (!filename) return;
  const absolute = path.join(HR_DIR, path.basename(filename));
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
}

async function context(monthValue) {
  const parts = monthParts(monthValue);
  const [work, rules, month, certificates] = await Promise.all([
    settings.getWorkHoursConfig(),
    getSettings(),
    attendance.overview({ month: parts.key }),
    absenceRepo.listBetween(parts.start, parts.end)
  ]);
  return {
    parts,
    startMinutes: minutesOf(work.start),
    timeZone: work.timezone || "Africa/Tunis",
    hours: rules.certDelayHours,
    month,
    certificates
  };
}

function countsForCertificate(day) {
  if (day.status === "ABSENT" || day.status === "NO_REPLY") return day.confirmed === true;
  return day.confirmedLate === true && (day.lateMinutes || 0) + (day.earlyMinutes || 0) > 0;
}

function dayDto(employee, day, ctx) {
  const certificate = ctx.certificates.find((row) => row.user_id === employee.id && row.day === day.day);
  const limit = deadline(day.day, ctx.startMinutes, ctx.hours, ctx.timeZone);
  return {
    day: day.day,
    status: day.status,
    lateMinutes: day.lateMinutes || 0,
    earlyMinutes: day.earlyMinutes || 0,
    deadline: limit.toISOString(),
    open: Date.now() <= limit.getTime(),
    submitted: Boolean(certificate),
    accepted: certificate?.accepted === true,
    filename: certificate?.original_filename || ""
  };
}

function absencesOf(employee, ctx) {
  return (employee?.days || [])
    .filter(countsForCertificate)
    .map((day) => dayDto(employee, day, ctx));
}

async function overview(query) {
  const ctx = await context(query.month);
  return {
    month: ctx.parts.key,
    certDelayHours: ctx.hours,
    employees: ctx.month.employees.map((employee) => ({
      id: employee.id,
      prenom: employee.prenom,
      nom: employee.nom,
      days: absencesOf(employee, ctx)
    }))
  };
}

async function mine(userId, query) {
  const ctx = await context(query.month);
  const employee = ctx.month.employees.find((row) => row.id === userId);
  return { month: ctx.parts.key, certDelayHours: ctx.hours, days: employee ? absencesOf(employee, ctx) : [] };
}

async function submit(userId, body, actor) {
  const day = String(body.day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw fail("Date invalide.");
  const staff = await hrRepo.findStaff(userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const ctx = await context(day.slice(0, 7));
  const employee = ctx.month.employees.find((row) => row.id === userId);
  const absence = (employee?.days || []).find((row) => row.day === day && countsForCertificate(row));
  if (!absence) throw fail("Cette journée n'est pas une absence.");
  const byAdmin = actor.role === "ADMIN";
  const inTime = onTime(new Date(), day, ctx.startMinutes, ctx.hours, ctx.timeZone);
  const decoded = decodeFile(body.file);
  const previous = await absenceRepo.find(userId, day);
  const stored = storeFile(userId, decoded.mimeType, decoded.buffer);
  const original = String(body.filename || "certificat").replace(/[^\w.\- ]+/g, "").slice(0, 180) || "certificat";
  await absenceRepo.save({
    userId,
    day,
    storedFilename: stored,
    originalFilename: original,
    mimeType: decoded.mimeType,
    submittedAt: new Date(),
    submittedBy: actor.sub,
    accepted: byAdmin || inTime
  });
  removeFile(previous?.stored_filename);
  return { ok: true, accepted: byAdmin || inTime, late: !byAdmin && !inTime };
}

async function accept(body) {
  const day = String(body.day || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw fail("Date invalide.");
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const saved = await absenceRepo.accept(body.userId, day);
  if (!saved) throw fail("Déposez d'abord le certificat.");
  return { ok: true };
}

async function openFile(userId, day) {
  const certificate = await absenceRepo.find(userId, day);
  if (!certificate) throw fail("Certificat introuvable.", 404);
  const absolutePath = path.join(HR_DIR, path.basename(certificate.stored_filename));
  if (!fs.existsSync(absolutePath)) throw fail("Le fichier n'existe plus sur le serveur.", 404);
  return { absolutePath, mimeType: certificate.mime_type, originalFilename: certificate.original_filename };
}

function shiftMonth(key, delta) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function remind(now = new Date()) {
  const current = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit" }).format(now);
  let sent = 0;
  for (const month of [shiftMonth(current, -1), current]) {
    const data = await overview({ month });
    for (const employee of data.employees) {
      for (const day of employee.days) {
        if (day.submitted || day.accepted || !shouldRemind(day.deadline, now)) continue;
        if (await absenceRepo.reminderExists(employee.id, day.day)) continue;
        const when = new Date(day.deadline).toLocaleString("fr-FR", { timeZone: "Africa/Tunis", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
        await notificationService.notify(employee.id, {
          type: "HR_CERTIFICATE",
          title: "Certificat à déposer",
          body: `Votre journée du ${day.day.split("-").reverse().join("/")} doit être justifiée avant le ${when}.`,
          link: "/rh"
        });
        await absenceRepo.markReminded(employee.id, day.day);
        sent += 1;
      }
    }
  }
  return { sent };
}

module.exports = { overview, mine, submit, accept, openFile, remind };
