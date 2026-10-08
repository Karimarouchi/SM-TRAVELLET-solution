const db = require("../../db");
const notificationService = require("./notificationService");
const logger = require("../logger");

// Versement des commissions (admin) : « à verser » = commission sans versement ;
// « payer » = créer un versement qui regroupe les commissions choisies d'un employé.

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const money = (value) => Math.round(Number(value) * 100) / 100;

function lineDto(row) {
  return {
    id: row.id,
    studentName: row.student_prenom ? `${row.student_prenom} ${row.student_nom || ""}`.trim() : "",
    countryName: row.country_name,
    role: row.role,
    stage: row.stage,
    amountDinar: money(row.amount_dinar),
    earnedAt: row.earned_at
  };
}

const LINES_SQL = `
  SELECT ce.id, ce.user_id, ce.role, ce.stage, ce.amount_dinar, ce.earned_at, ce.payout_id,
         c.name AS country_name, s.prenom AS student_prenom, s.nom AS student_nom
  FROM commission_earnings ce
  JOIN countries c ON c.id = ce.country_id
  JOIN users s ON s.id = ce.student_id`;

// Tous les employés qui ont des commissions à verser, avec le détail.
async function listDue() {
  const { rows } = await db.query(
    `${LINES_SQL.replace("SELECT ce.id,", "SELECT u.prenom AS user_prenom, u.nom AS user_nom, u.email AS user_email, u.is_active AS user_active, ce.id,").replace("JOIN users s ON s.id = ce.student_id", "JOIN users s ON s.id = ce.student_id JOIN users u ON u.id = ce.user_id")}
     WHERE ce.payout_id IS NULL
     ORDER BY ce.earned_at ASC`
  );
  const byUser = new Map();
  for (const row of rows) {
    const entry = byUser.get(row.user_id) || {
      userId: row.user_id,
      name: `${row.user_prenom || ""} ${row.user_nom || ""}`.trim(),
      email: row.user_email,
      isActive: row.user_active !== false,
      roles: [],
      total: 0,
      count: 0,
      oldestAt: row.earned_at,
      lines: []
    };
    if (!entry.roles.includes(row.role)) entry.roles.push(row.role);
    entry.total = money(entry.total + Number(row.amount_dinar));
    entry.count += 1;
    entry.lines.push(lineDto(row));
    byUser.set(row.user_id, entry);
  }
  const employees = [...byUser.values()].sort((a, b) => b.total - a.total);
  const monthPaid = await db.query(
    `SELECT COALESCE(SUM(amount_dinar), 0)::float AS total, COUNT(*)::int AS payouts
     FROM commission_payouts WHERE paid_at >= date_trunc('month', NOW())`
  );
  return {
    employees,
    totals: {
      due: money(employees.reduce((sum, e) => sum + e.total, 0)),
      dueCount: employees.reduce((sum, e) => sum + e.count, 0),
      employees: employees.length,
      paidThisMonth: money(monthPaid.rows[0].total),
      payoutsThisMonth: monthPaid.rows[0].payouts
    }
  };
}

async function payoutsFor(whereSql, params) {
  const { rows } = await db.query(
    `SELECT po.id, po.number, po.user_id, po.amount_dinar, po.earnings_count, po.paid_at,
            u.prenom AS user_prenom, u.nom AS user_nom, b.prenom AS by_prenom, b.nom AS by_nom
     FROM commission_payouts po
     JOIN users u ON u.id = po.user_id
     LEFT JOIN users b ON b.id = po.paid_by
     ${whereSql}
     ORDER BY po.paid_at DESC
     LIMIT 300`,
    params
  );
  if (!rows.length) return [];
  const lines = await db.query(`${LINES_SQL} WHERE ce.payout_id = ANY($1::uuid[]) ORDER BY ce.earned_at ASC`, [rows.map((r) => r.id)]);
  const linesBy = new Map();
  for (const line of lines.rows) {
    const list = linesBy.get(line.payout_id) || [];
    list.push(lineDto(line));
    linesBy.set(line.payout_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    userId: row.user_id,
    userName: `${row.user_prenom || ""} ${row.user_nom || ""}`.trim(),
    amountDinar: money(row.amount_dinar),
    count: row.earnings_count,
    paidAt: row.paid_at,
    paidByName: row.by_prenom ? `${row.by_prenom} ${row.by_nom || ""}`.trim() : null,
    lines: linesBy.get(row.id) || []
  }));
}

// Historique des versements, filtrable par employé, année et mois.
async function listPayouts({ userId, year, month } = {}) {
  const conditions = [];
  const params = [];
  if (userId && /^[0-9a-f-]{36}$/i.test(String(userId))) {
    params.push(userId);
    conditions.push(`po.user_id = $${params.length}`);
  }
  if (Number(year)) {
    params.push(Number(year));
    conditions.push(`EXTRACT(YEAR FROM po.paid_at) = $${params.length}`);
  }
  if (Number(month)) {
    params.push(Number(month));
    conditions.push(`EXTRACT(MONTH FROM po.paid_at) = $${params.length}`);
  }
  return payoutsFor(conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params);
}

// Fiche d'un employé : ce qui lui reste à verser et ses versements passés.
async function getUserCommissions(userId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId))) throw fail("Employé introuvable.", 404);
  const due = await db.query(`${LINES_SQL} WHERE ce.user_id = $1 AND ce.payout_id IS NULL ORDER BY ce.earned_at ASC`, [userId]);
  const payouts = await payoutsFor("WHERE po.user_id = $1", [userId]);
  const dueLines = due.rows.map(lineDto);
  return {
    due: dueLines,
    dueTotal: money(dueLines.reduce((sum, l) => sum + l.amountDinar, 0)),
    paidTotal: money(payouts.reduce((sum, p) => sum + p.amountDinar, 0)),
    payouts: payouts.slice(0, 20)
  };
}

// Verse les commissions d'un employé (toutes celles à verser, ou la sélection).
async function payUser(auth, userId, earningIds) {
  if (!/^[0-9a-f-]{36}$/i.test(String(userId))) throw fail("Employé introuvable.", 404);
  const ids = Array.isArray(earningIds) && earningIds.length ? [...new Set(earningIds.map(String))] : null;

  const payout = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, amount_dinar, role FROM commission_earnings
       WHERE user_id = $1 AND payout_id IS NULL ${ids ? "AND id = ANY($2::uuid[])" : ""}
       FOR UPDATE`,
      ids ? [userId, ids] : [userId]
    );
    if (!rows.length) throw fail("Aucune commission à verser pour cet employé.", 409);
    if (ids && rows.length !== ids.length) throw fail("Une des commissions est déjà versée ou introuvable.", 409);
    const total = money(rows.reduce((sum, r) => sum + Number(r.amount_dinar), 0));
    const year = new Date().getFullYear();
    const counter = await client.query(
      `INSERT INTO commission_payout_counters (year, last_number) VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE SET last_number = commission_payout_counters.last_number + 1
       RETURNING last_number`,
      [year]
    );
    const number = `VRS-${year}-${String(counter.rows[0].last_number).padStart(3, "0")}`;
    const created = await client.query(
      `INSERT INTO commission_payouts (number, user_id, amount_dinar, earnings_count, paid_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, number, paid_at`,
      [number, userId, total, rows.length, auth.sub]
    );
    await client.query("UPDATE commission_earnings SET payout_id = $1 WHERE id = ANY($2::uuid[])", [created.rows[0].id, rows.map((r) => r.id)]);
    return { id: created.rows[0].id, number, paidAt: created.rows[0].paid_at, amountDinar: total, count: rows.length, role: rows[0].role };
  });

  // L'employé est prévenu ; un échec de notification ne remet jamais en cause le versement.
  try {
    await notificationService.notify(userId, {
      type: "COMMISSION_PAID",
      title: `Commissions versées : ${payout.amountDinar.toFixed(2)} DT`,
      body: `${payout.count} commission${payout.count > 1 ? "s" : ""} payée${payout.count > 1 ? "s" : ""} (versement ${payout.number}).`,
      link: payout.role === "RDV" ? "/rdv" : "/conseiller"
    });
  } catch (error) {
    logger.error("Notification de versement impossible", { message: error.message });
  }
  return payout;
}

// « Payer tous » : un versement par employé qui a des commissions à verser.
async function payAll(auth) {
  const { employees } = await listDue();
  const payouts = [];
  for (const employee of employees) payouts.push(await payUser(auth, employee.userId));
  return { payouts: payouts.length, total: money(payouts.reduce((sum, p) => sum + p.amountDinar, 0)) };
}

module.exports = { listDue, listPayouts, getUserCommissions, payUser, payAll };
