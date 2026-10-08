const PDFDocument = require("pdfkit");
const path = require("path");
const db = require("../../db");

// Facturation (admin) : factures des étudiants qui ont payé par chèque ou par virement.

const INVOICEABLE_METHODS = ["CHEQUE", "TRANSFER"];
const METHOD_LABELS = { CHEQUE: "Chèque", TRANSFER: "Virement" };
const REFERENCE_LABELS = { CHEQUE: "n°", TRANSFER: "code" };
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo-sm-travel.png");

// Coordonnées de l'agence (identiques aux mentions légales du site).
const AGENCY = {
  company: "SM services & consulting",
  brand: "SM Travel",
  legalForm: "SARL",
  taxId: "1915331L",
  address: "4 Bis Rue du Mali, 4e étage, bureau n°4, Jeanne d’Arc, Tunis 1002, Tunisie",
  phone: "+216 56 819 899",
  email: "services@smtravel.fr",
  website: "www.smtravel.fr"
};

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const money = (value) => Math.round(Number(value) * 100) / 100;

function dateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

const frDate = (value) => {
  const [y, m, d] = String(dateOnly(value) || "").split("-");
  return y ? `${d}/${m}/${y}` : "";
};

// 1 500,00 DT — espaces ordinaires (les polices PDF standard n'affichent pas l'espace fine).
function formatAmount(amount, currency) {
  const [int, dec] = money(amount).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} ${currency === "EUR" ? "€" : "DT"}`;
}

// ── Liste : étudiants, paiements facturables, factures ──
async function listStudents() {
  const [paymentRows, invoiceRows] = await Promise.all([
    db.query(
      `SELECT p.id, p.student_id, p.tranche, p.amount, p.currency, p.method, p.reference, p.paid_at, p.receipt_number,
              u.prenom, u.nom, u.email, c.name AS country_name,
              il.invoice_id, inv.invoice_number
       FROM student_payments p
       JOIN payment_plans pp ON pp.id = p.plan_id
       JOIN countries c ON c.id = pp.country_id
       JOIN users u ON u.id = p.student_id
       LEFT JOIN invoice_lines il ON il.payment_id = p.id
       LEFT JOIN invoices inv ON inv.id = il.invoice_id
       WHERE p.status = 'ACTIVE' AND p.method = ANY($1)
       ORDER BY p.paid_at DESC, p.created_at DESC`,
      [INVOICEABLE_METHODS]
    ),
    db.query(
      `SELECT inv.id, inv.invoice_number, inv.student_id, inv.currency, inv.total, inv.issued_at,
              (SELECT COUNT(*)::int FROM invoice_lines il WHERE il.invoice_id = inv.id) AS lines,
              EXISTS (
                SELECT 1 FROM invoice_lines il JOIN student_payments p ON p.id = il.payment_id
                WHERE il.invoice_id = inv.id AND p.status = 'CANCELLED'
              ) AS has_cancelled
       FROM invoices inv
       ORDER BY inv.issued_at DESC, inv.created_at DESC`
    )
  ]);

  const students = new Map();
  for (const row of paymentRows.rows) {
    const entry = students.get(row.student_id) || {
      studentId: row.student_id,
      name: `${row.prenom || ""} ${row.nom || ""}`.trim(),
      email: row.email,
      payments: [],
      invoices: []
    };
    entry.payments.push({
      id: row.id,
      receiptNumber: row.receipt_number,
      tranche: row.tranche,
      countryName: row.country_name,
      method: row.method,
      methodLabel: METHOD_LABELS[row.method],
      referenceLabel: REFERENCE_LABELS[row.method],
      reference: row.reference,
      paidAt: dateOnly(row.paid_at),
      amount: money(row.amount),
      currency: row.currency,
      invoiceId: row.invoice_id || null,
      invoiceNumber: row.invoice_number || null
    });
    students.set(row.student_id, entry);
  }
  for (const inv of invoiceRows.rows) {
    const entry = students.get(inv.student_id);
    if (!entry) continue;
    entry.invoices.push({
      id: inv.id,
      number: inv.invoice_number,
      issuedAt: dateOnly(inv.issued_at),
      total: money(inv.total),
      currency: inv.currency,
      lines: inv.lines,
      hasCancelled: inv.has_cancelled
    });
  }

  return [...students.values()]
    .map((entry) => {
      const pending = entry.payments.filter((p) => !p.invoiceId);
      const totals = {};
      for (const p of pending) totals[p.currency] = money((totals[p.currency] || 0) + p.amount);
      return { ...entry, toInvoiceCount: pending.length, toInvoiceTotals: totals };
    })
    .sort((a, b) => b.toInvoiceCount - a.toInvoiceCount || a.name.localeCompare(b.name));
}

// ── Création : un paiement ne peut être facturé qu'une fois ──
async function createInvoice(auth, { studentId, paymentIds }) {
  const ids = [...new Set((Array.isArray(paymentIds) ? paymentIds : []).map(String))];
  if (!studentId || !ids.length) throw fail("Choisissez au moins un paiement à facturer.", 400);

  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT p.id, p.student_id, p.amount, p.currency, p.method, p.status, il.invoice_id
       FROM student_payments p
       LEFT JOIN invoice_lines il ON il.payment_id = p.id
       WHERE p.id = ANY($1::uuid[]) FOR UPDATE OF p`,
      [ids]
    );
    if (rows.length !== ids.length) throw fail("Un des paiements est introuvable.", 404);
    if (rows.some((r) => r.student_id !== studentId)) throw fail("Tous les paiements doivent appartenir au même étudiant.", 400);
    if (rows.some((r) => r.status !== "ACTIVE")) throw fail("Un paiement annulé ne peut pas être facturé.", 400);
    if (rows.some((r) => !INVOICEABLE_METHODS.includes(r.method))) throw fail("Seuls les paiements par chèque ou virement sont facturés ici.", 400);
    if (rows.some((r) => r.invoice_id)) throw fail("Un des paiements a déjà été facturé.", 409);
    const currencies = new Set(rows.map((r) => r.currency));
    if (currencies.size > 1) throw fail("Une facture ne peut regrouper que des paiements dans la même monnaie (DT ou €).", 400);

    const year = new Date().getFullYear();
    const counter = await client.query(
      `INSERT INTO invoice_counters (year, last_number) VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE SET last_number = invoice_counters.last_number + 1
       RETURNING last_number`,
      [year]
    );
    const number = `FAC-${year}-${String(counter.rows[0].last_number).padStart(3, "0")}`;
    const total = money(rows.reduce((sum, r) => sum + Number(r.amount), 0));
    const invoice = await client.query(
      `INSERT INTO invoices (invoice_number, student_id, currency, total, issued_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, invoice_number, issued_at`,
      [number, studentId, rows[0].currency, total, auth.sub]
    );
    for (const row of rows) {
      await client.query("INSERT INTO invoice_lines (invoice_id, payment_id) VALUES ($1, $2)", [invoice.rows[0].id, row.id]);
    }
    return { id: invoice.rows[0].id, number, total, currency: rows[0].currency, issuedAt: dateOnly(invoice.rows[0].issued_at) };
  });
}

// ── PDF ──
async function loadInvoice(invoiceId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(invoiceId))) throw fail("Facture introuvable.", 404);
  const invoice = (
    await db.query(
      `SELECT inv.*, u.prenom, u.nom, u.email, sp.phone, sp.city, sp.residence_country
       FROM invoices inv
       JOIN users u ON u.id = inv.student_id
       LEFT JOIN student_profiles sp ON sp.user_id = inv.student_id
       WHERE inv.id = $1`,
      [invoiceId]
    )
  ).rows[0];
  if (!invoice) throw fail("Facture introuvable.", 404);
  const lines = (
    await db.query(
      `SELECT p.tranche, p.amount, p.currency, p.method, p.reference, p.paid_at, p.receipt_number, c.name AS country_name
       FROM invoice_lines il
       JOIN student_payments p ON p.id = il.payment_id
       JOIN payment_plans pp ON pp.id = p.plan_id
       JOIN countries c ON c.id = pp.country_id
       WHERE il.invoice_id = $1
       ORDER BY p.paid_at ASC, p.created_at ASC`,
      [invoiceId]
    )
  ).rows;
  return { invoice, lines };
}

const PURPLE = "#4c1d95";
const SOFT = "#f3effc";
const GREY = "#64748b";
const DARK = "#0f172a";

function drawInvoice(doc, { invoice, lines }) {
  const left = 48;
  const right = doc.page.width - 48;
  const width = right - left;

  // En-tête : logo à gauche, numéro et date à droite
  try {
    doc.image(LOGO_PATH, left, 42, { width: 150 });
  } catch {
    doc.font("Helvetica-Bold").fontSize(20).fillColor(PURPLE).text(AGENCY.brand, left, 48);
  }
  doc.font("Helvetica-Bold").fontSize(26).fillColor(PURPLE).text("FACTURE", left, 44, { width, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(GREY).text(`N° ${invoice.invoice_number}`, left, 76, { width, align: "right" });
  doc.text(`Date : ${frDate(invoice.issued_at)}`, left, 90, { width, align: "right" });
  doc.moveTo(left, 122).lineTo(right, 122).lineWidth(1.5).strokeColor(PURPLE).stroke();

  // Émetteur / client
  const boxTop = 142;
  const half = width / 2 - 8;
  const box = (x, title, rows) => {
    doc.roundedRect(x, boxTop, half, 118, 8).fillColor(SOFT).fill();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(PURPLE).text(title, x + 14, boxTop + 12);
    let y = boxTop + 28;
    rows.forEach((row, i) => {
      doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(i === 0 ? 11 : 9).fillColor(i === 0 ? DARK : GREY);
      doc.text(row, x + 14, y, { width: half - 28 });
      y = doc.y + 2;
    });
  };
  box(left, "ÉMETTEUR", [
    `${AGENCY.company} (${AGENCY.legalForm})`,
    `Marque : ${AGENCY.brand} · MF ${AGENCY.taxId}`,
    AGENCY.address,
    `${AGENCY.phone} · ${AGENCY.email}`
  ]);
  const place = [invoice.city, invoice.residence_country].filter(Boolean).join(", ");
  box(left + half + 16, "FACTURÉ À", [
    `${invoice.prenom || ""} ${invoice.nom || ""}`.trim(),
    invoice.email,
    invoice.phone ? `Tél. ${invoice.phone}` : "",
    place
  ].filter(Boolean));

  // Tableau des paiements
  let y = boxTop + 150;
  const cols = [
    { label: "Désignation", x: left + 10, w: 160 },
    { label: "Reçu n°", x: left + 176, w: 58 },
    { label: "Mode de paiement", x: left + 240, w: 108 },
    { label: "Date", x: left + 354, w: 52 },
    { label: "Montant", x: left + 410, w: width - 420 }
  ];
  doc.roundedRect(left, y, width, 26, 6).fillColor(PURPLE).fill();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#ffffff");
  cols.forEach((c, i) => doc.text(c.label, c.x, y + 9, { width: c.w, align: i === cols.length - 1 ? "right" : "left" }));
  y += 32;

  lines.forEach((line, index) => {
    const designation = `${Number(line.tranche) === 1 ? "Tranche 1 · inscription" : "Tranche 2 · visa"} — ${line.country_name}`;
    const mode = `${METHOD_LABELS[line.method]} ${REFERENCE_LABELS[line.method]} ${line.reference || "—"}`;
    const rowHeight = Math.max(
      doc.heightOfString(designation, { width: cols[0].w }),
      doc.heightOfString(mode, { width: cols[2].w })
    ) + 14;
    if (y + rowHeight > doc.page.height - 190) {
      doc.addPage();
      y = 60;
    }
    if (index % 2 === 0) doc.rect(left, y - 4, width, rowHeight).fillColor("#faf8ff").fill();
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(designation, cols[0].x, y + 2, { width: cols[0].w });
    doc.text(line.receipt_number || "—", cols[1].x, y + 2, { width: cols[1].w });
    doc.text(mode, cols[2].x, y + 2, { width: cols[2].w });
    doc.text(frDate(line.paid_at), cols[3].x, y + 2, { width: cols[3].w });
    doc.font("Helvetica-Bold").text(formatAmount(line.amount, line.currency), cols[4].x, y + 2, { width: cols[4].w, align: "right" });
    y += rowHeight;
  });

  // Total + mention « acquittée »
  y += 12;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.8).strokeColor("#e2e8f0").stroke();
  y += 14;
  doc.roundedRect(right - 230, y, 230, 46, 8).fillColor(PURPLE).fill();
  doc.font("Helvetica").fontSize(8.5).fillColor("#e9defa").text("TOTAL PAYÉ", right - 214, y + 9);
  doc.font("Helvetica-Bold").fontSize(17).fillColor("#ffffff").text(formatAmount(invoice.total, invoice.currency), right - 214, y + 21, { width: 198, align: "right" });
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#059669").text("FACTURE ACQUITTÉE", left, y + 8);
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text("Les sommes ci-dessus ont été réglées et encaissées par l’agence.", left, y + 26, { width: width - 250 });

  // Pied de page
  const footerY = doc.page.height - 84;
  doc.moveTo(left, footerY).lineTo(right, footerY).lineWidth(0.6).strokeColor("#e2e8f0").stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(
    `${AGENCY.company} (${AGENCY.legalForm}) · MF ${AGENCY.taxId} · ${AGENCY.address}\n${AGENCY.phone} · ${AGENCY.email} · ${AGENCY.website}`,
    left,
    footerY + 10,
    { width, align: "center", lineGap: 3 }
  );
}

async function renderPdf(invoiceId, stream) {
  const data = await loadInvoice(invoiceId);
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Facture ${data.invoice.invoice_number}`, Author: AGENCY.company } });
  doc.pipe(stream);
  drawInvoice(doc, data);
  doc.end();
  return data.invoice.invoice_number;
}

module.exports = { listStudents, createInvoice, renderPdf, loadInvoice };
