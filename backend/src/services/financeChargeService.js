const { query } = require("../../db");

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function round3(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

function iso(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function yearOf(value) {
  const year = Number(value) || new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw fail("Année invalide.");
  return year;
}

function todayIso() {
  return iso(new Date());
}

function monthsCovered(startsOn, endsOn, year) {
  const pad = (month) => `${year}-${String(month).padStart(2, "0")}`;
  const startKey = String(startsOn || `${year}-01-01`).slice(0, 7);
  const endKey = String(endsOn || `${year}-12-01`).slice(0, 7);
  const from = startKey < pad(1) ? pad(1) : startKey;
  let to = endKey > pad(12) ? pad(12) : endKey;
  if (from.slice(0, 4) !== String(year) || to.slice(0, 4) !== String(year) || from > to) return 0;
  return Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
}

function chargeCost(row, year, collected, today) {
  if (row.basis === "PERCENT") {
    if (row.kind === "VARIABLE" && iso(row.spent_on)?.slice(0, 4) !== String(year)) return 0;
    return round3(collected * Number(row.percent || 0) / 100);
  }
  if (row.kind === "VARIABLE") return iso(row.spent_on)?.slice(0, 4) === String(year) ? round3(row.amount) : 0;
  return round3(Number(row.amount) * monthsCovered(iso(row.starts_on), iso(row.ends_on), year));
}

function dto(row, year, collected, today) {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    basis: row.basis,
    amount: round3(row.amount),
    percent: row.percent === null || row.percent === undefined ? null : round3(row.percent),
    startsOn: iso(row.starts_on),
    endsOn: iso(row.ends_on),
    spentOn: iso(row.spent_on),
    yearCost: chargeCost(row, year, collected, today)
  };
}

async function exercise(yearValue) {
  const year = yearOf(yearValue);
  const today = todayIso();
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const [collected, personnel, payouts, charges, salaryRows] = await Promise.all([
    query(
      `SELECT currency, COALESCE(SUM(amount), 0)::float AS total
       FROM student_payments
       WHERE status = 'ACTIVE' AND paid_at >= $1 AND paid_at < $2
       GROUP BY currency`,
      [from, to]
    ),
    query(
      `SELECT COALESCE(SUM(base_salary), 0)::float AS salaries,
              COALESCE(SUM(bonus), 0)::float AS primes,
              COALESCE(SUM(paid_leave), 0)::float AS paid_leave,
              COALESCE(SUM(CASE WHEN presence_adjustment IS NOT NULL
                THEN presence_adjustment
                ELSE absence_deduction + lateness_deduction + unpaid_holiday_deduction END), 0)::float AS deductions
       FROM hr_payslips
       WHERE month >= $1 AND month < $2`,
      [from, to]
    ),
    query(
      `SELECT COALESCE(SUM(amount_dinar), 0)::float AS total
       FROM commission_payouts
       WHERE paid_at >= $1 AND paid_at < $2`,
      [from, to]
    ),
    query("SELECT * FROM finance_charges ORDER BY kind, created_at"),
    query(
      `SELECT p.id, p.user_id, u.prenom, u.nom, p.month::text AS month, p.amount::float AS amount, p.paid_on::text AS paid_on,
              EXISTS (SELECT 1 FROM hr_payslips s WHERE s.user_id = p.user_id AND s.month = p.month) AS on_slip
       FROM hr_salary_payments p
       JOIN users u ON u.id = p.user_id
       WHERE p.paid_on >= $1 AND p.paid_on < $2
       ORDER BY p.paid_on DESC, u.nom`,
      [from, to]
    )
  ]);
  const byCurrency = Object.fromEntries(collected.rows.map((row) => [row.currency, round3(row.total)]));
  const collectedTnd = byCurrency.TND || 0;
  const people = personnel.rows[0] || {};
  const salaries = round3(people.salaries);
  const primes = round3(people.primes);
  const paidLeave = round3(people.paid_leave);
  const deductions = round3(people.deductions);
  const commissions = round3(payouts.rows[0]?.total);
  const listed = charges.rows.map((row) => dto(row, year, collectedTnd, today));
  const fixed = round3(listed.filter((row) => row.kind === "FIXED").reduce((sum, row) => sum + row.yearCost, 0));
  const variable = round3(listed.filter((row) => row.kind === "VARIABLE").reduce((sum, row) => sum + row.yearCost, 0));
  const salaryPayments = salaryRows.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    prenom: row.prenom,
    nom: row.nom,
    month: String(row.month).slice(0, 7),
    amount: round3(row.amount),
    paidOn: String(row.paid_on).slice(0, 10),
    onSlip: row.on_slip === true
  }));
  const salaryExtra = round3(salaryPayments.filter((row) => !row.onSlip).reduce((sum, row) => sum + row.amount, 0));
  const personnelCost = round3(salaries + primes + paidLeave - deductions + commissions + salaryExtra);
  return {
    year,
    collected: collectedTnd,
    collectedEur: byCurrency.EUR || 0,
    salaries,
    primes,
    paidLeave,
    deductions,
    commissions,
    salaryPayments,
    salaryExtra,
    personnel: personnelCost,
    fixed,
    variable,
    result: round3(collectedTnd - personnelCost - fixed - variable),
    charges: listed
  };
}

function cleanDate(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(value || ""));
  if (!match) return null;
  const day = match[3] || "01";
  const isoDate = `${match[1]}-${match[2]}-${day}`;
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoDate;
}

async function create(body) {
  const kind = body.kind === "VARIABLE" ? "VARIABLE" : body.kind === "FIXED" ? "FIXED" : "";
  if (!kind) throw fail("Choisissez une charge fixe ou variable.");
  const label = String(body.label || "").trim().slice(0, 160);
  if (label.length < 2) throw fail("Le nom de la charge est obligatoire.");
  const basis = body.basis === "PERCENT" ? "PERCENT" : "AMOUNT";
  const amount = round3(body.amount);
  const percent = body.percent === "" || body.percent === null || body.percent === undefined ? null : round3(body.percent);
  if (basis === "AMOUNT" && amount < 0) throw fail("Le montant ne peut pas être négatif.");
  if (basis === "PERCENT" && (percent === null || percent < 0 || percent > 100)) throw fail("Le pourcentage doit être entre 0 et 100.");
  const startsOn = kind === "FIXED" ? cleanDate(body.startsOn) : null;
  const endsOn = kind === "FIXED" ? cleanDate(body.endsOn) : null;
  const spentOn = kind === "VARIABLE" ? cleanDate(body.spentOn) : null;
  if (kind === "FIXED" && !startsOn) throw fail("Indiquez le mois de début.");
  if (kind === "VARIABLE" && !spentOn) throw fail("Indiquez la date de la dépense.");
  if (startsOn && endsOn && endsOn < startsOn) throw fail("La fin est avant le début.");
  await query(
    `INSERT INTO finance_charges (kind, label, basis, amount, percent, starts_on, ends_on, spent_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [kind, label, basis, basis === "AMOUNT" ? amount : 0, basis === "PERCENT" ? percent : null, startsOn, endsOn, spentOn]
  );
  return exercise(body.year);
}

async function remove(id, year) {
  const result = await query("DELETE FROM finance_charges WHERE id = $1", [id]);
  if (!result.rowCount) throw fail("Charge introuvable.", 404);
  return exercise(year);
}

module.exports = { exercise, create, remove };
