const PDFDocument = require("pdfkit");
const path = require("path");
const db = require("../../db");
const settingsRepo = require("../repositories/settingsRepository");
const { amountInWords } = require("./amountInWords");

// Facturation (admin) : factures des étudiants qui ont payé par chèque ou par virement.

const INVOICEABLE_METHODS = ["CHEQUE", "TRANSFER"];
const METHOD_LABELS = { CHEQUE: "Chèque", TRANSFER: "Virement" };
const REFERENCE_LABELS = { CHEQUE: "n°", TRANSFER: "code" };
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo-sm-travel.png");

// Coordonnées de l'agence (identiques aux mentions légales du site).
const AGENCY = {
  company: "SM services & consulting",
  brand: "SM Edu Travel",
  legalForm: "SARL",
  taxId: "1915331L",
  address: "4 Bis Rue du Mali, 4e étage, bureau n°4, Jeanne d’Arc, Tunis 1002, Tunisie",
  phone: "+216 56 819 899",
  email: "contact@smedutravel.com",
  website: "www.smedutravel.com"
};

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const money = (value) => Math.round(Number(value) * 100) / 100;

// Le dinar tunisien se divise en 1000 millimes : une facture en DT affiche 3 décimales ; l'euro en a 2.
const decimalsOf = (currency) => (currency === "EUR" ? 2 : 3);
const roundTo = (value, decimals) => Math.round(Number(value) * 10 ** decimals) / 10 ** decimals;

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
  const decimals = decimalsOf(currency);
  const [int, dec] = roundTo(amount, decimals).toFixed(decimals).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} ${currency === "EUR" ? "€" : "DT"}`;
}

// ── TVA ──
// Le montant payé est un montant TTC : la facture en déduit le hors taxe et la TVA, jamais l'inverse.
const DEFAULT_VAT_RATE = 19;

async function getVatRate() {
  const raw = await settingsRepo.get("invoice_vat_rate");
  const rate = Number(raw);
  return raw !== null && Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : DEFAULT_VAT_RATE;
}

async function setVatRate(value) {
  const rate = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw fail("Le taux de TVA doit être compris entre 0 et 100 %.", 400);
  await settingsRepo.set("invoice_vat_rate", String(Math.round(rate * 100) / 100));
}

// ── Timbre fiscal ──
// Droit de timbre porté sur la facture (1 DT par défaut, réglable dans Paramètres). Il n'est pas soumis à la TVA.
const DEFAULT_STAMP_DUTY = 1;

async function getStampDuty() {
  const raw = await settingsRepo.get("invoice_stamp_duty");
  const value = Number(raw);
  return raw !== null && Number.isFinite(value) && value >= 0 && value <= 1000 ? value : DEFAULT_STAMP_DUTY;
}

async function setStampDuty(value) {
  const stamp = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(stamp) || stamp < 0 || stamp > 1000) throw fail("Le timbre fiscal doit être compris entre 0 et 1 000 DT.", 400);
  await settingsRepo.set("invoice_stamp_duty", String(Math.round(stamp * 1000) / 1000));
}

// Hors taxe de chaque ligne et totaux. Le total TTC est exactement la somme payée : hors taxe + TVA + timbre fiscal.
// Le timbre n'est pas soumis à la TVA, la TVA se calcule donc sur le reste. Les arrondis (au millime, ou au centime
// en euro) sont reportés sur la dernière ligne pour que les colonnes s'additionnent.
function computeTotals(amounts, rate, currency, stampDuty = 0) {
  const decimals = decimalsOf(currency);
  const factor = 1 + Number(rate) / 100;
  const paid = roundTo(amounts.reduce((sum, value) => sum + Number(value), 0), decimals);
  // Le timbre ne dépasse jamais la somme payée.
  const stamp = currency === "EUR" ? 0 : Math.min(roundTo(stampDuty, decimals), paid);
  const taxable = roundTo(paid - stamp, decimals);
  const ht = roundTo(taxable / factor, decimals);
  // Part de chaque ligne dans la base taxable (au prorata de son paiement).
  const share = amounts.map((value) => (paid > 0 ? roundTo((taxable * Number(value)) / paid, decimals) : 0));
  const shareDrift = roundTo(taxable - share.reduce((sum, value) => sum + value, 0), decimals);
  if (share.length) share[share.length - 1] = roundTo(share[share.length - 1] + shareDrift, decimals);
  const lineHt = share.map((value) => roundTo(value / factor, decimals));
  const drift = roundTo(ht - lineHt.reduce((sum, value) => sum + value, 0), decimals);
  if (lineHt.length) lineHt[lineHt.length - 1] = roundTo(lineHt[lineHt.length - 1] + drift, decimals);
  return { lineHt, ht, vat: roundTo(taxable - ht, decimals), stamp, ttc: paid };
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
    const number = invoiceNumber(year, counter.rows[0].last_number);
    const total = money(rows.reduce((sum, r) => sum + Number(r.amount), 0));
    const vatRate = await getVatRate();
    const stampDuty = rows[0].currency === "EUR" ? 0 : await getStampDuty();
    const invoice = await client.query(
      `INSERT INTO invoices (invoice_number, student_id, currency, total, issued_by, vat_rate, stamp_duty)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, invoice_number, issued_at`,
      [number, studentId, rows[0].currency, total, auth.sub, vatRate, stampDuty]
    );
    for (const row of rows) {
      await client.query("INSERT INTO invoice_lines (invoice_id, payment_id) VALUES ($1, $2)", [invoice.rows[0].id, row.id]);
    }
    return { id: invoice.rows[0].id, number, total, currency: rows[0].currency, issuedAt: dateOnly(invoice.rows[0].issued_at) };
  });
}

// ── Numérotation ──
// Un compteur par année : chaque 1er janvier repart de FAC-AAAA-000000.
const invoiceNumber = (year, value) => `FAC-${year}-${String(value).padStart(6, "0")}`;

async function getInvoiceCounter() {
  const year = new Date().getFullYear();
  const { rows } = await db.query("SELECT last_number FROM invoice_counters WHERE year = $1", [year]);
  return { year, lastNumber: rows[0]?.last_number || 0 };
}

async function setInvoiceCounter(value) {
  const lastNumber = Number(value);
  if (!Number.isInteger(lastNumber) || lastNumber < 0 || lastNumber > 999999) throw fail("Le numéro de facture doit être compris entre 0 et 999999.", 400);
  const year = new Date().getFullYear();
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(substring(invoice_number from '[0-9]+$')::int), 0) AS issued FROM invoices WHERE invoice_number LIKE $1`,
    [`FAC-${year}-%`]
  );
  if (lastNumber < rows[0].issued) throw fail(`La facture ${invoiceNumber(year, rows[0].issued)} existe déjà : le dernier numéro ne peut pas être plus petit.`, 400);
  await db.query(
    `INSERT INTO invoice_counters (year, last_number) VALUES ($1, $2)
     ON CONFLICT (year) DO UPDATE SET last_number = EXCLUDED.last_number`,
    [year, lastNumber]
  );
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

const percent = (rate) => `${Number(rate).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

function drawInvoice(doc, { invoice, lines }) {
  const left = 48;
  const right = doc.page.width - 48;
  const width = right - left;
  const currency = invoice.currency;
  const rate = invoice.vat_rate === null || invoice.vat_rate === undefined ? DEFAULT_VAT_RATE : Number(invoice.vat_rate);
  const stampDuty = invoice.stamp_duty === null || invoice.stamp_duty === undefined ? (currency === "EUR" ? 0 : DEFAULT_STAMP_DUTY) : Number(invoice.stamp_duty);
  const totals = computeTotals(lines.map((line) => line.amount), rate, currency, stampDuty);

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
    `Marque : ${AGENCY.brand}`,
    `Matricule fiscal : ${AGENCY.taxId}`,
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

  // Prestations : prix unitaire hors taxe, TVA, total HT et TTC
  let y = boxTop + 140;
  const cols = [
    { label: "Désignation", x: left + 10, w: 200, align: "left" },
    { label: "Qté", x: left + 214, w: 30, align: "center" },
    { label: "P.U. HT", x: left + 250, w: 90, align: "right" },
    { label: "TVA", x: left + 346, w: 44, align: "center" },
    { label: "Total HT", x: left + 396, w: width - 406, align: "right" }
  ];
  doc.roundedRect(left, y, width, 26, 6).fillColor(PURPLE).fill();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#ffffff");
  cols.forEach((c) => doc.text(c.label, c.x, y + 9, { width: c.w, align: c.align }));
  y += 32;

  lines.forEach((line, index) => {
    const designation = `${Number(line.tranche) === 1 ? "Frais d'accompagnement · inscription" : "Frais d'accompagnement · visa"} — ${line.country_name}`;
    const rowHeight = doc.heightOfString(designation, { width: cols[0].w }) + 14;
    if (y + rowHeight > doc.page.height - 120) {
      doc.addPage();
      y = 60;
    }
    if (index % 2 === 0) doc.rect(left, y - 4, width, rowHeight).fillColor("#faf8ff").fill();
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(designation, cols[0].x, y + 2, { width: cols[0].w });
    doc.text("1", cols[1].x, y + 2, { width: cols[1].w, align: "center" });
    doc.text(formatAmount(totals.lineHt[index], currency), cols[2].x, y + 2, { width: cols[2].w, align: "right" });
    doc.text(percent(rate), cols[3].x, y + 2, { width: cols[3].w, align: "center" });
    doc.font("Helvetica-Bold").text(formatAmount(totals.lineHt[index], currency), cols[4].x, y + 2, { width: cols[4].w, align: "right" });
    y += rowHeight;
  });

  // Règlements : reçu, mode et date de chaque paiement (la facture est acquittée)
  y += 10;
  if (y + 60 + lines.length * 16 > doc.page.height - 260) {
    doc.addPage();
    y = 60;
  }
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PURPLE).text("RÈGLEMENT", left + 10, y);
  y += 14;
  const pay = [
    { label: "Reçu n°", x: left + 10, w: 70, align: "left" },
    { label: "Mode de règlement", x: left + 84, w: 200, align: "left" },
    { label: "Date", x: left + 290, w: 70, align: "left" },
    { label: "Montant TTC", x: left + 364, w: width - 374, align: "right" }
  ];
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(GREY);
  pay.forEach((c) => doc.text(c.label, c.x, y, { width: c.w, align: c.align }));
  y += 12;
  doc.moveTo(left, y - 2).lineTo(right, y - 2).lineWidth(0.5).strokeColor("#e2e8f0").stroke();
  lines.forEach((line) => {
    // Chèque : numéro ; virement : aucun code à saisir (les anciens virements gardent leur code).
    const mode = line.method === "CHEQUE" || line.reference ? `${METHOD_LABELS[line.method]} ${REFERENCE_LABELS[line.method]} ${line.reference || "—"}` : METHOD_LABELS[line.method];
    doc.font("Helvetica").fontSize(8.5).fillColor(DARK);
    doc.text(line.receipt_number || "—", pay[0].x, y + 2, { width: pay[0].w });
    doc.text(mode, pay[1].x, y + 2, { width: pay[1].w });
    doc.text(frDate(line.paid_at), pay[2].x, y + 2, { width: pay[2].w });
    doc.text(formatAmount(line.amount, currency), pay[3].x, y + 2, { width: pay[3].w, align: "right" });
    y += 16;
  });

  // Totaux : hors taxe, TVA, TTC
  y += 14;
  if (y + 170 > doc.page.height - 100) {
    doc.addPage();
    y = 60;
  }
  const totalsLeft = right - 230;
  const row = (label, value) => {
    doc.font("Helvetica").fontSize(9.5).fillColor(GREY).text(label, totalsLeft + 6, y, { width: 110 });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(DARK).text(value, totalsLeft + 110, y, { width: 114, align: "right" });
    y += 18;
  };
  row("Total HT", formatAmount(totals.ht, currency));
  row(`TVA (${percent(rate)})`, formatAmount(totals.vat, currency));
  if (totals.stamp > 0) row("Timbre fiscal", formatAmount(totals.stamp, currency));
  doc.moveTo(totalsLeft, y - 2).lineTo(right, y - 2).lineWidth(0.6).strokeColor("#e2e8f0").stroke();
  y += 4;
  doc.roundedRect(totalsLeft, y, 230, 46, 8).fillColor(PURPLE).fill();
  doc.font("Helvetica").fontSize(8.5).fillColor("#e9defa").text("TOTAL TTC", totalsLeft + 14, y + 9);
  doc.font("Helvetica-Bold").fontSize(17).fillColor("#ffffff").text(formatAmount(totals.ttc, currency), totalsLeft + 14, y + 21, { width: 202, align: "right" });

  // À gauche : mention acquittée et montant en toutes lettres
  const leftBlock = y - 40;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#059669").text("FACTURE ACQUITTÉE", left, leftBlock);
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text("Les sommes ci-dessus ont été réglées et encaissées par l’agence.", left, leftBlock + 17, { width: width - 250 });
  doc.font("Helvetica").fontSize(8.5).fillColor(DARK).text(
    `Arrêtée la présente facture à la somme de : ${amountInWords(totals.ttc, currency)} TTC.`,
    left,
    leftBlock + 44,
    { width: width - 250 }
  );

  // Pied de page
  const footerY = doc.page.height - 92;
  doc.moveTo(left, footerY).lineTo(right, footerY).lineWidth(0.6).strokeColor("#e2e8f0").stroke();
  doc.font("Helvetica").fontSize(7.5).fillColor(GREY).text(
    `${AGENCY.company} (${AGENCY.legalForm}) · Matricule fiscal : ${AGENCY.taxId}\n${AGENCY.address}\nTél. : ${AGENCY.phone} · E-mail : ${AGENCY.email} · ${AGENCY.website}`,
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

module.exports = { listStudents, createInvoice, renderPdf, loadInvoice, getInvoiceCounter, setInvoiceCounter, getVatRate, setVatRate, getStampDuty, setStampDuty, computeTotals };
