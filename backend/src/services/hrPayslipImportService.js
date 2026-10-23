const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const hrRepo = require("../repositories/hrRepository");
const payrollRepo = require("../repositories/hrPayrollRepository");
const logger = require("../logger");

const HR_DIR = path.join(__dirname, "../../uploads/hr");
const IMPORT_DIR = path.join(HR_DIR, "imports");
const SCRIPT = path.join(__dirname, "../../scripts/read_payslip.py");
const MAX_FILE_BYTES = 8 * 1024 * 1024;

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
  return { key: `${match[1]}-${match[2]}`, start: `${match[1]}-${match[2]}-01` };
}

function amount(value) {
  if (value === null || value === undefined || String(value).trim() === "") return 0;
  const number = Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > 10000000) throw fail("Montant invalide.");
  return Math.round(number * 1000) / 1000;
}

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function roundOrNull(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Math.round(Number(value) * 1000) / 1000;
}

function suggestUser(staff, slip) {
  const name = fold(slip.employeeName);
  const cnss = String(slip.cnss || "").replace(/\D/g, "");
  let best = null;
  let score = 0;
  for (const person of staff) {
    const full = fold(`${person.prenom} ${person.nom}`);
    const flipped = fold(`${person.nom} ${person.prenom}`);
    const personCnss = String(person.cnss_number || "").replace(/\D/g, "");
    let next = 0;
    if (cnss && personCnss && personCnss === cnss) next += 3;
    if (name && (name === full || name === flipped)) next += 2;
    else if (name && full && (full.includes(name) || name.includes(full))) next += 1;
    if (next > score) {
      score = next;
      best = person;
    }
  }
  return best ? best.id : null;
}

function resolvePython() {
  const names = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
  for (const name of names) {
    const probe = spawnSync(name, ["--version"], { windowsHide: true });
    if (!probe.error && probe.status === 0) return name;
  }
  return names[0];
}

const PYTHON = resolvePython();

function runPython(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [SCRIPT, ...args], { windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(fail("La lecture du bulletin a pris trop de temps."));
    }, 90000);
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });
    child.on("error", () => {
      clearTimeout(timer);
      reject(fail("La lecture du bulletin est indisponible sur ce serveur."));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        logger.warn("Lecture de bulletin impossible", { message: err.slice(0, 400) });
        reject(fail("Impossible de lire ce bulletin."));
        return;
      }
      resolve(out);
    });
  });
}

function decodePdf(fileBase64) {
  const match = String(fileBase64 || "").match(/^data:application\/pdf;base64,([\s\S]+)$/);
  if (!match) throw fail("Déposez un fichier PDF.");
  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw fail("Le PDF est vide ou dépasse 8 Mo.");
  return buffer;
}

async function preview(body) {
  const buffer = decodePdf(body.file);
  fs.mkdirSync(IMPORT_DIR, { recursive: true });
  const fileId = crypto.randomUUID();
  const stored = path.join(IMPORT_DIR, `${fileId}.pdf`);
  fs.writeFileSync(stored, buffer);
  let pages;
  try {
    const raw = await runPython(["extract", stored]);
    pages = JSON.parse(raw);
  } catch (error) {
    fs.unlinkSync(stored);
    throw error;
  }
  if (!Array.isArray(pages) || !pages.length) {
    fs.unlinkSync(stored);
    throw fail("Aucune page lisible dans ce PDF.");
  }
  const staff = await hrRepo.listStaff();
  return {
    fileId,
    employees: staff.map((person) => ({
      id: person.id,
      prenom: person.prenom,
      nom: person.nom,
      cnss: person.cnss_number || ""
    })),
    slips: pages.map((page) => ({
      page: page.page,
      month: page.year && page.month ? `${page.year}-${String(page.month).padStart(2, "0")}` : "",
      employeeName: page.employeeName || "",
      matricule: page.matricule || "",
      cnss: page.cnss || "",
      suggestedUserId: suggestUser(staff, page),
      baseSalary: roundOrNull(page.baseSalary),
      presenceDays: roundOrNull(page.presenceDays),
      presenceRate: roundOrNull(page.presenceRate),
      presenceAmount: roundOrNull(page.presenceAmount),
      leaveDays: roundOrNull(page.leaveDays),
      leaveRate: roundOrNull(page.leaveRate),
      leaveAmount: roundOrNull(page.leaveAmount),
      transport: roundOrNull(page.transport),
      presenceBonus: roundOrNull(page.presenceBonus),
      functionAllowance: roundOrNull(page.functionAllowance),
      responsibilityBonus: roundOrNull(page.responsibilityBonus),
      total: roundOrNull(page.total),
      gross: roundOrNull(page.gross),
      cnssDeduction: roundOrNull(page.cnssDeduction),
      taxable: roundOrNull(page.taxable),
      irpp: roundOrNull(page.irpp),
      css: roundOrNull(page.css),
      net: roundOrNull(page.net),
      netToPay: roundOrNull(page.netToPay)
    }))
  };
}

async function confirm(auth, body) {
  const fileId = String(body.fileId || "");
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw fail("Fichier introuvable.", 404);
  const source = path.join(IMPORT_DIR, `${fileId}.pdf`);
  if (!fs.existsSync(source)) throw fail("Ce fichier n'est plus disponible. Importez-le à nouveau.", 404);
  const slips = Array.isArray(body.slips) ? body.slips : [];
  if (!slips.length) throw fail("Aucune fiche à enregistrer.");
  const staff = await hrRepo.listStaff();
  const seen = new Set();
  const saved = [];
  for (const slip of slips) {
    const person = staff.find((row) => row.id === slip.userId);
    if (!person) throw fail("Choisissez l'employé qui correspond à chaque bulletin.");
    const parts = monthParts(slip.month);
    const key = `${person.id}|${parts.start}`;
    if (seen.has(key)) throw fail("Deux pages visent le même employé et le même mois.");
    seen.add(key);
    const page = Number(slip.page);
    if (!Number.isInteger(page) || page < 0 || page > 40) throw fail("Page de bulletin invalide.");
    fs.mkdirSync(HR_DIR, { recursive: true });
    const storedFilename = `bulletin_${person.id.slice(0, 8)}_${parts.key.replace("-", "")}_${Date.now()}.pdf`;
    await runPython(["split", source, String(page), path.join(HR_DIR, storedFilename)]);
    const previous = await payrollRepo.findOfficial(person.id, parts.start);
    await payrollRepo.upsertOfficial({
      userId: person.id,
      month: parts.start,
      employeeName: String(slip.employeeName || "").slice(0, 160),
      matricule: String(slip.matricule || "").slice(0, 40),
      cnss: String(slip.cnss || "").replace(/\D/g, "").slice(0, 20),
      baseSalary: amount(slip.baseSalary),
      presenceDays: amount(slip.presenceDays),
      presenceRate: amount(slip.presenceRate),
      presenceAmount: amount(slip.presenceAmount),
      leaveDays: amount(slip.leaveDays),
      leaveRate: amount(slip.leaveRate),
      leaveAmount: amount(slip.leaveAmount),
      transport: amount(slip.transport),
      presenceBonus: amount(slip.presenceBonus),
      functionAllowance: amount(slip.functionAllowance),
      responsibilityBonus: amount(slip.responsibilityBonus),
      gross: amount(slip.gross),
      cnssDeduction: amount(slip.cnssDeduction),
      taxable: amount(slip.taxable),
      irpp: amount(slip.irpp),
      css: amount(slip.css),
      net: amount(slip.net),
      netToPay: amount(slip.netToPay),
      storedFilename,
      originalFilename: String(body.filename || "bulletin.pdf").replace(/[^\w.\- ]+/g, "").slice(0, 180) || "bulletin.pdf",
      confirmedBy: auth.sub
    });
    if (previous?.stored_filename && previous.stored_filename !== storedFilename) {
      const oldPath = path.join(HR_DIR, path.basename(previous.stored_filename));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    saved.push({ userId: person.id, month: parts.key });
  }
  fs.unlinkSync(source);
  return { saved };
}

async function remove(body) {
  const parts = monthParts(body.month);
  const staff = await hrRepo.findStaff(body.userId);
  if (!staff) throw fail("Employé introuvable.", 404);
  const removed = await payrollRepo.deleteOfficial(body.userId, parts.start);
  if (!removed) throw fail("Aucun bulletin officiel pour ce mois.", 404);
  const absolute = path.join(HR_DIR, path.basename(removed.stored_filename));
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  return { ok: true };
}

async function openFile(userId, monthValue) {
  const parts = monthParts(monthValue);
  const row = await payrollRepo.findOfficial(userId, parts.start);
  if (!row) return null;
  const absolutePath = path.join(HR_DIR, path.basename(row.stored_filename));
  if (!fs.existsSync(absolutePath)) throw fail("Le PDF du bulletin n'est plus sur le serveur.", 404);
  return { absolutePath, filename: `Bulletin-${parts.key}.pdf` };
}

function num(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function officialOf(row) {
  if (!row) return null;
  return {
    id: row.id,
    month: String(row.month).slice(0, 7),
    employeeName: row.employee_name || "",
    matricule: row.matricule || "",
    cnss: row.cnss_number || "",
    baseSalary: num(row.base_salary),
    presenceDays: num(row.presence_days),
    presenceAmount: num(row.presence_amount),
    leaveDays: num(row.leave_days),
    leaveAmount: num(row.leave_amount),
    transport: num(row.transport),
    presenceBonus: num(row.presence_bonus),
    functionAllowance: num(row.function_allowance),
    responsibilityBonus: num(row.responsibility_bonus),
    gross: num(row.gross),
    cnssDeduction: num(row.cnss),
    taxable: num(row.taxable),
    irpp: num(row.irpp),
    css: num(row.css),
    net: num(row.net),
    netToPay: num(row.net_to_pay)
  };
}

module.exports = { preview, confirm, remove, openFile, officialOf };
