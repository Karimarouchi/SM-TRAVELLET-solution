const paymentRepo = require("../repositories/paymentRepository");
const countryRepo = require("../repositories/countryRepository");
const studentRepo = require("../repositories/studentRepository");
const userRepo = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const emailService = require("./emailService");
const logger = require("../logger");
const { canAccessStudent, authRoles } = require("../security/rbac");

// Deux tranches par pays : 1 = inscription (à la création du code), 2 = avant le
// dépôt du visa. Montants en DT (TND) ou en euro selon le pays.
const CURRENCIES = ["TND", "EUR"];
const METHODS = ["CASH", "TRANSFER", "CARD", "CHEQUE"];
const METHOD_LABELS = { CASH: "Espèces", TRANSFER: "Virement", CARD: "Carte", CHEQUE: "Chèque" };
const CURRENCY_LABELS = { TND: "DT", EUR: "€" };

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const cents = (value) => Math.round(Number(value || 0) * 100);
const money = (value) => cents(value) / 100;

function formatAmount(amount, currency) {
  return `${money(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${CURRENCY_LABELS[currency] || currency}`;
}

function normalizeAmount(raw, label) {
  const value = Number(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) throw fail(`${label} invalide.`, 400);
  return money(value);
}

function normalizeMethod(raw) {
  const method = String(raw || "").toUpperCase();
  if (!METHODS.includes(method)) throw fail("Choisissez le mode de paiement (espèces, virement, carte ou chèque).", 400);
  return method;
}

function normalizeDate(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw fail("Date de paiement invalide.", 400);
  if (date.getTime() > Date.now() + 24 * 3600 * 1000) throw fail("La date de paiement ne peut pas être dans le futur.", 400);
  return date.toISOString().slice(0, 10);
}

// Une colonne DATE revient en objet Date à minuit local : on garde le jour tel quel.
function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  return String(value).slice(0, 10);
}

// Numéro du chèque / code du virement : obligatoire selon le mode, pour pouvoir
// retrouver le paiement. Espèces et carte n'ont pas de référence à saisir : le
// numéro de reçu automatique suffit.
const REFERENCE_LABELS = { CHEQUE: "Numéro du chèque", TRANSFER: "Code du virement" };

async function normalizeMethodReference(method, raw) {
  if (!REFERENCE_LABELS[method]) return null;
  const reference = String(raw || "").trim().replace(/\s+/g, " ");
  if (!reference) throw fail(`${REFERENCE_LABELS[method]} obligatoire.`, 400);
  if (!/^[A-Za-z0-9][A-Za-z0-9 \-/.]{2,39}$/.test(reference)) {
    throw fail(`${REFERENCE_LABELS[method]} invalide (3 à 40 caractères : lettres, chiffres, - / .).`, 400);
  }
  const duplicate = await paymentRepo.findActiveByMethodReference(method, reference);
  if (duplicate) {
    throw fail(`Ce ${method === "CHEQUE" ? "numéro de chèque" : "code de virement"} est déjà enregistré (reçu ${duplicate.receipt_number || "en attente"}).`, 409);
  }
  return reference;
}

// ── Tarifs ──
function pricingDto(row) {
  return {
    countryId: row.country_id,
    countryName: row.country_name,
    code: row.code,
    configured: row.tranche1_amount !== null && row.tranche1_amount !== undefined,
    currency: row.currency || "TND",
    tranche1: row.tranche1_amount === null || row.tranche1_amount === undefined ? null : money(row.tranche1_amount),
    tranche2: row.tranche2_amount === null || row.tranche2_amount === undefined ? null : money(row.tranche2_amount)
  };
}

async function listPricing() {
  return (await paymentRepo.listPricing()).map(pricingDto);
}

async function getPricingForCountry(countryId) {
  const country = await countryRepo.findById(countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  const row = await paymentRepo.findPricing(countryId);
  return pricingDto({ country_id: country.id, country_name: country.name, code: country.code, ...(row || {}) });
}

async function setPricing(auth, countryId, payload) {
  const country = await countryRepo.findById(countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  const currency = String(payload.currency || "TND").toUpperCase();
  if (!CURRENCIES.includes(currency)) throw fail("Monnaie invalide (DT ou euro).", 400);
  const tranche1 = normalizeAmount(payload.tranche1, "Le montant de la tranche 1");
  const tranche2 = normalizeAmount(payload.tranche2, "Le montant de la tranche 2");
  if (tranche1 + tranche2 <= 0) throw fail("Le prix total doit être supérieur à zéro.", 400);
  await paymentRepo.upsertPricing({ countryId, currency, tranche1, tranche2, updatedBy: auth.sub });
  return getPricingForCountry(countryId);
}

async function removePricing(countryId) {
  await paymentRepo.removePricing(countryId);
  return getPricingForCountry(countryId);
}

// ── Plans et paiements ──
function trancheState(due, paid) {
  const dueC = cents(due);
  const paidC = cents(paid);
  return {
    due: money(due),
    paid: money(paid),
    remaining: Math.max(0, dueC - paidC) / 100,
    complete: paidC >= dueC
  };
}

function planDto(row) {
  const t1 = trancheState(row.tranche1_due, row.paid1);
  const t2 = trancheState(row.tranche2_due, row.paid2);
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: `${row.student_prenom || ""} ${row.student_nom || ""}`.trim(),
    countryId: row.country_id,
    countryName: row.country_name,
    currency: row.currency,
    salesId: row.assigned_sales_id || null,
    salesName: row.sales_prenom ? `${row.sales_prenom} ${row.sales_nom || ""}`.trim() : null,
    dossierStage: row.dossier_stage || null,
    tranche1: t1,
    tranche2: t2,
    total: money(row.tranche1_due) + money(row.tranche2_due),
    paidTotal: t1.paid + t2.paid,
    remainingTotal: t1.remaining + t2.remaining,
    status: t1.complete && t2.complete ? "PAID" : t1.paid + t2.paid > 0 ? "PARTIAL" : "UNPAID",
    // Retard : la tranche 2 est exigible dès que le dossier est en phase visa.
    late: !t1.complete || (row.dossier_stage === "VISA" && !t2.complete),
    createdAt: row.created_at
  };
}

function paymentDto(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    studentId: row.student_id,
    countryName: row.country_name,
    tranche: row.tranche,
    amount: money(row.amount),
    currency: row.currency,
    method: row.method,
    methodLabel: METHOD_LABELS[row.method] || row.method,
    paidAt: dateOnly(row.paid_at),
    receiptNumber: row.receipt_number,
    reference: row.reference,
    referenceLabel: REFERENCE_LABELS[row.method] || null,
    studentId: row.student_id,
    studentName: row.student_prenom ? `${row.student_prenom} ${row.student_nom || ""}`.trim() : undefined,
    recordedByName: row.by_prenom ? `${row.by_prenom} ${row.by_nom || ""}`.trim() : null,
    recordedByRole: row.recorded_by_role,
    status: row.status,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at
  };
}

async function ensurePlan(studentId, countryId) {
  const existing = await paymentRepo.findPlan(studentId, countryId);
  if (existing) return existing;
  const pricing = await paymentRepo.findPricing(countryId);
  if (!pricing) throw fail("Aucun tarif n'est défini pour ce pays. Définissez-le d'abord dans Finance > Tarifs.", 400);
  await paymentRepo.createPlan({
    studentId,
    countryId,
    currency: pricing.currency,
    tranche1Due: pricing.tranche1_amount,
    tranche2Due: pricing.tranche2_amount
  });
  return paymentRepo.findPlan(studentId, countryId);
}

async function assertStudentAccess(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return profile;
}

async function summaryForStudent(auth, studentId) {
  await assertStudentAccess(auth, studentId);
  const isAdmin = authRoles(auth).includes("ADMIN");
  const plans = (await paymentRepo.listPlansForStudent(studentId)).map(planDto);
  const payments = (await paymentRepo.listPaymentsForStudent(studentId)).map(paymentDto);
  return { plans, payments: isAdmin ? payments : payments.filter((p) => p.status === "ACTIVE"), canCancel: isAdmin };
}

// Enregistre un paiement (admin, ou conseiller de l'étudiant).
async function recordPayment(auth, studentId, payload) {
  const roles = authRoles(auth);
  if (!roles.includes("ADMIN") && !roles.includes("SALES")) throw fail("Action réservée à l'administrateur ou au conseiller.", 403);
  await assertStudentAccess(auth, studentId);

  const tranche = Number(payload.tranche);
  if (![1, 2].includes(tranche)) throw fail("Choisissez la tranche (1 ou 2).", 400);
  if (!payload.countryId) throw fail("Choisissez le pays concerné.", 400);
  const method = normalizeMethod(payload.method);
  const reference = await normalizeMethodReference(method, payload.reference);
  const plan = await ensurePlan(studentId, payload.countryId);
  const state = trancheState(tranche === 1 ? plan.tranche1_due : plan.tranche2_due, tranche === 1 ? plan.paid1 : plan.paid2);
  if (state.complete) throw fail(`La tranche ${tranche} est déjà entièrement payée.`, 409);

  const amount = payload.amount === undefined || payload.amount === "" ? state.remaining : normalizeAmount(payload.amount, "Le montant");
  if (amount <= 0) throw fail("Le montant doit être supérieur à zéro.", 400);
  if (cents(amount) > cents(state.remaining)) {
    throw fail(`Le montant dépasse le reste dû pour la tranche ${tranche} (${formatAmount(state.remaining, plan.currency)}).`, 400);
  }

  const created = await paymentRepo.createPayment({
    planId: plan.id,
    studentId,
    tranche,
    amount,
    currency: plan.currency,
    method,
    // Date proposée par défaut = aujourd'hui ; le conseiller comme l'admin peuvent la corriger (jamais dans le futur).
    paidAt: normalizeDate(payload.paidAt),
    reference,
    recordedBy: auth.sub,
    recordedByRole: roles.includes("ADMIN") ? "ADMIN" : "SALES"
  });
  await sendReceiptEmail(studentId, created);
  return summaryForStudent(auth, studentId);
}

// Reçu envoyé par e-mail à l'étudiant (un échec d'envoi ne bloque jamais le paiement).
async function sendReceiptEmail(studentId, payment) {
  try {
    const student = await userRepo.findById(studentId);
    if (!student?.email) return;
    const plan = await paymentRepo.findPlanById(payment.plan_id);
    if (!plan) return;
    const planInfo = planDto(plan);
    await emailService.sendPaymentReceiptEmail(student.email, student.prenom, {
      receiptNumber: payment.receipt_number,
      amountLabel: formatAmount(payment.amount, payment.currency),
      trancheLabel: Number(payment.tranche) === 1 ? "Tranche 1 · inscription" : "Tranche 2 · visa",
      countryName: plan.country_name,
      dateLabel: new Date(`${dateOnly(payment.paid_at)}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
      methodLabel: METHOD_LABELS[payment.method] || payment.method,
      referenceLabel: REFERENCE_LABELS[payment.method] || null,
      reference: payment.reference,
      totalLabel: formatAmount(planInfo.total, plan.currency),
      paidLabel: formatAmount(planInfo.paidTotal, plan.currency),
      remainingLabel: planInfo.remainingTotal > 0 ? formatAmount(planInfo.remainingTotal, plan.currency) : "Aucun : paiement soldé"
    });
  } catch (error) {
    logger.error("Échec de l'envoi du reçu de paiement", { message: error.message });
  }
}

// Annulation (admin) : le paiement reste visible dans l'historique.
async function cancelPayment(auth, paymentId, reason) {
  if (!authRoles(auth).includes("ADMIN")) throw fail("Seul l'administrateur peut annuler un paiement.", 403);
  const trimmed = String(reason || "").trim().slice(0, 300);
  if (!trimmed) throw fail("Indiquez le motif de l'annulation.", 400);
  const payment = await paymentRepo.findPayment(paymentId);
  if (!payment) throw fail("Paiement introuvable.", 404);
  if (payment.status !== "ACTIVE") throw fail("Ce paiement est déjà annulé.", 409);
  await paymentRepo.cancelPayment(paymentId, { cancelledBy: auth.sub, reason: trimmed });
  return summaryForStudent(auth, payment.student_id);
}

// ── Code d'inscription : tranche 1 confirmée à la création ──

// Valide la confirmation d'encaissement saisie à la création du code. Renvoie
// null si le pays n'a pas de tarif (aucun paiement attendu).
async function prepareCodePayment(countryId, payment) {
  const pricing = await paymentRepo.findPricing(countryId);
  if (!pricing) return null;
  if (cents(pricing.tranche1_amount) > 0) {
    if (!payment || payment.confirmed !== true) {
      throw fail(`Confirmez l'encaissement de la tranche 1 (${formatAmount(pricing.tranche1_amount, pricing.currency)}) pour générer le code.`, 400);
    }
  }
  const paying = cents(pricing.tranche1_amount) > 0;
  const method = paying ? normalizeMethod(payment.method) : null;
  const reference = paying ? await normalizeMethodReference(method, payment.reference) : null;
  return {
    currency: pricing.currency,
    tranche1: money(pricing.tranche1_amount),
    tranche2: money(pricing.tranche2_amount),
    method,
    reference,
    // Date de l'encaissement : aujourd'hui par défaut, modifiable par le conseiller (jamais dans le futur).
    paidAt: paying ? normalizeDate(payment.paidAt) : null,
    // Le reçu est numéroté dès l'encaissement, pour être remis au client.
    receiptNumber: paying ? await paymentRepo.nextReceiptNumber() : null
  };
}

// Appelé quand l'étudiant s'inscrit avec le code : crée son plan et enregistre
// la tranche 1 déjà encaissée.
async function applyCodePayment(studentId, claimed) {
  if (!claimed.country_id || claimed.payment_tranche1 === null || claimed.payment_tranche1 === undefined) return;
  const plan = await paymentRepo.createPlan({
    studentId,
    countryId: claimed.country_id,
    currency: claimed.payment_currency,
    tranche1Due: claimed.payment_tranche1,
    tranche2Due: claimed.payment_tranche2
  });
  if (cents(claimed.payment_tranche1) > 0) {
    const created = await paymentRepo.createPayment({
      planId: plan.id,
      studentId,
      tranche: 1,
      amount: claimed.payment_tranche1,
      currency: claimed.payment_currency,
      method: claimed.payment_method,
      paidAt: dateOnly(claimed.payment_paid_at) || dateOnly(claimed.created_at),
      reference: claimed.payment_reference,
      receiptNumber: claimed.payment_receipt,
      recordedBy: claimed.sales_id,
      recordedByRole: "SALES"
    });
    // Le reçu de la tranche 1 part dès que le compte de l'étudiant existe.
    await sendReceiptEmail(studentId, created);
  }
}

// Tranche visa restant à payer pour un dossier (null si rien n'est dû ou si
// l'étudiant n'a pas de plan) : sert à avertir le RDV avant même qu'il clique.
async function visaPaymentDue(studentId, countryId) {
  const plan = await paymentRepo.findPlan(studentId, countryId);
  if (!plan) return null;
  const t2 = trancheState(plan.tranche2_due, plan.paid2);
  if (t2.complete) return null;
  return { remaining: t2.remaining, currency: plan.currency };
}

// Tranche inscription restant à payer (null si rien n'est dû ou pas de plan).
async function registrationPaymentDue(studentId, countryId) {
  const plan = await paymentRepo.findPlan(studentId, countryId);
  if (!plan) return null;
  const t1 = trancheState(plan.tranche1_due, plan.paid1);
  if (t1.complete) return null;
  return { remaining: t1.remaining, currency: plan.currency };
}

// ── Blocage du dépôt de la candidature (tranche 1) ──
async function assertRegistrationPaid(application) {
  const plan = await paymentRepo.findPlan(application.student_id, application.country_id);
  if (!plan) return;
  const t1 = trancheState(plan.tranche1_due, plan.paid1);
  if (t1.complete) return;

  const student = await userRepo.findById(application.student_id);
  const who = student ? `${student.prenom} ${student.nom}`.trim() : "L'étudiant";
  const remaining = formatAmount(t1.remaining, plan.currency);
  const payload = {
    type: "PAYMENT_BLOCKED",
    title: `Paiement inscription non réglé : ${who}`,
    body: `Le Responsable Dossier ne peut pas déposer la candidature de ${who} (${plan.country_name}) : il reste ${remaining} à payer (tranche 1).`
  };
  if (plan.assigned_sales_id) await notificationService.notify(plan.assigned_sales_id, { ...payload, link: `/conseiller/etudiants/${application.student_id}` });
  await notificationService.notifyAdmins({ ...payload, link: `/admin/finance?student=${application.student_id}` });
  throw fail(`${who} n'a pas réglé son paiement : il reste ${remaining} à payer (tranche 1) avant de déposer la candidature.`, 409);
}

// ── Blocage du dépôt visa ──
// Un étudiant qui n'a pas de plan (inscrit avant cette fonction, ou pays sans
// tarif) n'est jamais bloqué.
async function assertVisaPaid(application) {
  const plan = await paymentRepo.findPlan(application.student_id, application.country_id);
  if (!plan) return;
  const t2 = trancheState(plan.tranche2_due, plan.paid2);
  if (t2.complete) return;

  const student = await userRepo.findById(application.student_id);
  const who = student ? `${student.prenom} ${student.nom}`.trim() : "L'étudiant";
  const remaining = formatAmount(t2.remaining, plan.currency);
  const salesId = plan.assigned_sales_id;
  const payload = {
    type: "PAYMENT_BLOCKED",
    title: `Paiement visa non réglé : ${who}`,
    body: `Le Responsable Dossier ne peut pas déposer le visa de ${who} (${plan.country_name}) : il reste ${remaining} à payer (tranche 2).`
  };
  if (salesId) await notificationService.notify(salesId, { ...payload, link: `/conseiller/etudiants/${application.student_id}` });
  await notificationService.notifyAdmins({ ...payload, link: `/admin/finance?student=${application.student_id}` });
  throw fail(`${who} n'a pas réglé son paiement : il reste ${remaining} à payer (tranche 2) avant de déposer le dossier visa.`, 409);
}

// Journal des paiements (admin) : recherche par reçu, chèque, virement ou étudiant.
async function listJournal(filters = {}) {
  let rows = (await paymentRepo.listJournal()).map(paymentDto);
  if (METHODS.includes(String(filters.method || "").toUpperCase())) rows = rows.filter((p) => p.method === String(filters.method).toUpperCase());
  if (filters.status === "ACTIVE" || filters.status === "CANCELLED") rows = rows.filter((p) => p.status === filters.status);
  const q = String(filters.q || "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((p) => [p.receiptNumber, p.reference, p.studentName, p.countryName].some((v) => String(v || "").toLowerCase().includes(q)));
  }
  return rows;
}

// ── Tableau de bord Finance (admin) ──
function addTo(map, key, currency, field, amount) {
  const entry = map.get(key) || {};
  const bucket = entry[currency] || { collected: 0, remaining: 0 };
  bucket[field] += amount;
  entry[currency] = bucket;
  map.set(key, entry);
}

async function overview() {
  const plans = (await paymentRepo.listPlans()).map(planDto);
  const totals = await paymentRepo.collectedTotals();

  const collected = {};
  for (const row of totals) collected[row.currency] = { total: money(row.total), month: money(row.month) };
  const remaining = {};
  const byCountry = new Map();
  const bySales = new Map();
  for (const plan of plans) {
    remaining[plan.currency] = (remaining[plan.currency] || 0) + plan.remainingTotal;
    addTo(byCountry, plan.countryName, plan.currency, "collected", plan.paidTotal);
    addTo(byCountry, plan.countryName, plan.currency, "remaining", plan.remainingTotal);
    const salesKey = plan.salesName || "Sans conseiller";
    addTo(bySales, salesKey, plan.currency, "collected", plan.paidTotal);
    addTo(bySales, salesKey, plan.currency, "remaining", plan.remainingTotal);
  }
  const toList = (map) => [...map.entries()].map(([name, byCurrency]) => ({ name, byCurrency })).sort((a, b) => a.name.localeCompare(b.name));
  return {
    collected,
    remaining,
    lateCount: plans.filter((p) => p.late).length,
    planCount: plans.length,
    byCountry: toList(byCountry),
    bySales: toList(bySales)
  };
}

// Statistiques détaillées par mois / par année (admin). Les montants restent
// séparés par devise ; le découpage par année est fait côté interface.
async function stats() {
  const rows = await paymentRepo.statsByMonth();
  const num = (v) => money(v);
  return {
    months: rows.months.map((r) => ({
      month: r.month,
      currency: r.currency,
      collected: num(r.collected),
      count: r.count,
      tranche1: num(r.t1),
      tranche2: num(r.t2),
      methods: { CASH: num(r.cash), TRANSFER: num(r.transfer), CARD: num(r.card), CHEQUE: num(r.cheque) },
      cancelledCount: r.cancelled_count,
      cancelledAmount: num(r.cancelled_amount)
    })),
    byCountry: rows.countries.map((r) => ({ month: r.month, currency: r.currency, name: r.name, collected: num(r.collected) })),
    bySales: rows.sales.map((r) => ({ month: r.month, currency: r.currency, name: r.name, collected: num(r.collected) })),
    billed: rows.billed.map((r) => ({ month: r.month, currency: r.currency, plans: r.plans, due: num(r.due) }))
  };
}

// Liste filtrable des plans (admin) : statut, pays, conseiller, recherche.
async function listPlans(filters = {}) {
  let plans = (await paymentRepo.listPlans()).map(planDto);
  if (filters.status === "late") plans = plans.filter((p) => p.late);
  else if (["PAID", "PARTIAL", "UNPAID"].includes(filters.status)) plans = plans.filter((p) => p.status === filters.status);
  if (filters.countryId) plans = plans.filter((p) => p.countryId === filters.countryId);
  if (filters.salesId) plans = plans.filter((p) => p.salesId === filters.salesId);
  const q = String(filters.q || "").trim().toLowerCase();
  if (q) plans = plans.filter((p) => p.studentName.toLowerCase().includes(q));
  return plans.slice(0, 500);
}

module.exports = {
  METHODS,
  listPricing,
  getPricingForCountry,
  setPricing,
  removePricing,
  summaryForStudent,
  recordPayment,
  cancelPayment,
  prepareCodePayment,
  applyCodePayment,
  assertVisaPaid,
  visaPaymentDue,
  registrationPaymentDue,
  assertRegistrationPaid,
  overview,
  stats,
  listPlans,
  listJournal
};
