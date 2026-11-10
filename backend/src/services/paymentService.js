const { query } = require("../../db");
const paymentRepo = require("../repositories/paymentRepository");
const countryRepo = require("../repositories/countryRepository");
const studentRepo = require("../repositories/studentRepository");
const userRepo = require("../repositories/userRepository");
const notificationService = require("./notificationService");
const emailService = require("./emailService");
const logger = require("../logger");
const { canAccessStudent, authRoles } = require("../security/rbac");
const leaveCover = require("./leaveCover");
const { canViewStudent } = require("../security/studentView");
const programmeService = require("./programmeService");

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

// ── Remises ──
const DISCOUNT_KINDS = ["PERCENT", "AMOUNT"];

// Remise en pourcentage (0–100) ou en montant fixe, dans la monnaie du plan (DT ou €).
function normalizeDiscount(raw) {
  const kind = String(raw?.kind || "").toUpperCase();
  if (!DISCOUNT_KINDS.includes(kind)) throw fail("Choisissez le type de remise : pourcentage ou montant.", 400);
  const value = Number(String(raw?.value ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) throw fail("Indiquez une remise supérieure à zéro.", 400);
  if (kind === "PERCENT" && value > 100) throw fail("Une remise en pourcentage ne peut pas dépasser 100 %.", 400);
  if (value > 10_000_000) throw fail("Remise invalide.", 400);
  return { kind, value: money(value), reason: String(raw?.reason || "").trim().slice(0, 300) || null };
}

// Montant de la remise sur le prix catalogue de la tranche (arrondi au centime).
function discountAmount(base, kind, value) {
  const amountCents = kind === "PERCENT" ? Math.round((cents(base) * Number(value)) / 100) : cents(value);
  return amountCents / 100;
}

function discountLabel(kind, value, currency) {
  return kind === "PERCENT" ? `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %` : formatAmount(value, currency);
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
// Libellés d'affichage (l'historique garde le code des anciens virements) ; seul le chèque demande une saisie.
const REFERENCE_LABELS = { CHEQUE: "Numéro du chèque", TRANSFER: "Code du virement" };
const INPUT_REFERENCE_METHODS = new Set(["CHEQUE"]);

async function normalizeMethodReference(method, raw) {
  if (!INPUT_REFERENCE_METHODS.has(method)) return null;
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
function pricingDto(row, levels = []) {
  const countryConfigured = row.tranche1_amount !== null && row.tranche1_amount !== undefined;
  const pricedLevels = levels.filter((level) => level.configured);
  const configured = levels.length ? pricedLevels.length === levels.length : countryConfigured;
  return {
    countryId: row.country_id,
    countryName: row.country_name,
    code: row.code,
    configured,
    currency: row.currency || "TND",
    tranche1: row.tranche1_amount === null || row.tranche1_amount === undefined ? null : money(row.tranche1_amount),
    tranche2: row.tranche2_amount === null || row.tranche2_amount === undefined ? null : money(row.tranche2_amount),
    levels
  };
}

function levelPriceDto(level, priceRow) {
  const configured = Boolean(priceRow);
  return {
    levelId: level.id,
    levelName: level.name,
    configured,
    currency: priceRow?.currency || "TND",
    tranche1: configured ? money(priceRow.tranche1_amount) : null,
    tranche2: configured ? money(priceRow.tranche2_amount) : null
  };
}

async function pricingWithLevels(row) {
  const byCountry = await programmeService.levelsByCountry();
  const prices = await paymentRepo.listLevelPricing();
  const levels = (byCountry.get(row.country_id) || []).map((level) => {
    const price = prices.find((item) => item.country_id === row.country_id && item.level_id === level.id);
    return levelPriceDto(level, price);
  });
  return pricingDto(row, levels);
}

async function listPricing() {
  const rows = await paymentRepo.listPricing();
  const byCountry = await programmeService.levelsByCountry();
  const prices = await paymentRepo.listLevelPricing();
  return rows.map((row) => {
    const levels = (byCountry.get(row.country_id) || []).map((level) => {
      const price = prices.find((item) => item.country_id === row.country_id && item.level_id === level.id);
      return levelPriceDto(level, price);
    });
    return pricingDto(row, levels);
  });
}

async function getPricingForCountry(countryId) {
  const country = await countryRepo.findById(countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  const row = await paymentRepo.findPricing(countryId);
  return pricingWithLevels({ country_id: country.id, country_name: country.name, code: country.code, ...(row || {}) });
}

function readAmounts(payload) {
  const currency = String(payload.currency || "TND").toUpperCase();
  if (!CURRENCIES.includes(currency)) throw fail("Monnaie invalide (DT ou euro).", 400);
  const tranche1 = normalizeAmount(payload.tranche1, "Le montant de la tranche 1");
  const tranche2 = normalizeAmount(payload.tranche2, "Le montant de la tranche 2");
  if (tranche1 + tranche2 <= 0) throw fail("Le prix total doit être supérieur à zéro.", 400);
  return { currency, tranche1, tranche2 };
}

async function setPricing(auth, countryId, payload) {
  const country = await countryRepo.findById(countryId);
  if (!country) throw fail("Pays introuvable.", 404);
  const amounts = readAmounts(payload);
  const levelId = String(payload.levelId || "").trim();
  if (levelId) {
    const levels = await programmeService.levelsForCountry(countryId);
    if (!levels.some((level) => level.id === levelId)) throw fail("Ce niveau n'appartient pas à ce pays.", 400);
    await paymentRepo.upsertLevelPricing({ countryId, levelId, ...amounts, updatedBy: auth.sub });
  } else {
    await paymentRepo.upsertPricing({ countryId, ...amounts, updatedBy: auth.sub });
  }
  return getPricingForCountry(countryId);
}

async function removePricing(countryId, levelId) {
  if (levelId) await paymentRepo.removeLevelPricing(countryId, levelId);
  else await paymentRepo.removePricing(countryId);
  return getPricingForCountry(countryId);
}

// Tarif applicable : le niveau s'il y en a, sinon le tarif unique du pays.
// Renvoie null quand le choix n'est pas encore complet ou qu'aucun prix n'est défini.
async function resolveTariff(countryId, levelId) {
  const levels = await programmeService.levelsForCountry(countryId);
  if (levels.length) {
    if (!levelId) return null;
    const level = levels.find((item) => item.id === levelId);
    if (!level) throw fail("Ce niveau n'appartient pas à ce pays.", 400);
    const price = await paymentRepo.findLevelPricing(countryId, levelId);
    if (!price) return null;
    return {
      levelId: level.id,
      levelName: level.name,
      currency: price.currency,
      tranche1: money(price.tranche1_amount),
      tranche2: money(price.tranche2_amount)
    };
  }
  const price = await paymentRepo.findPricing(countryId);
  if (!price) return null;
  return {
    levelId: null,
    levelName: null,
    currency: price.currency,
    tranche1: money(price.tranche1_amount),
    tranche2: money(price.tranche2_amount)
  };
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

// Aujourd'hui (AAAA-MM-JJ) et validation d'une date limite : jamais dans le passé.
function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDeadline(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw fail("Date limite invalide.", 400);
  const day = date.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (day < yesterday) throw fail("La date limite ne peut pas être dans le passé.", 400);
  return day;
}

function planDto(row) {
  const deadline1 = dateOnly(row.tranche1_deadline);
  const deadline2 = dateOnly(row.tranche2_deadline);
  // due = montant à payer (net de remise) ; base = prix catalogue ; discount = remise accordée.
  const t1 = { ...trancheState(row.tranche1_due, row.paid1), base: money(row.tranche1_base), discount: money(row.tranche1_discount), deadline: deadline1 };
  const t2 = { ...trancheState(row.tranche2_due, row.paid2), base: money(row.tranche2_base), discount: money(row.tranche2_discount), deadline: deadline2 };
  const today = todayYmd();
  // Tant que la date limite promise n'est pas dépassée, le reste à payer n'est pas « en retard ».
  const waiting1 = Boolean(deadline1) && deadline1 >= today;
  const waiting2 = Boolean(deadline2) && deadline2 >= today;
  // La tranche 2 n'est due qu'après l'acceptation par une université de ce pays.
  const tranche2Due = row.university_accepted === true;
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
    tranche2Due,
    dueNow: t1.remaining + (tranche2Due ? t2.remaining : 0),
    status: t1.complete && t2.complete ? "PAID" : t1.paid + t2.paid > 0 ? "PARTIAL" : "UNPAID",
    late: (!t1.complete && !waiting1) || (tranche2Due && !t2.complete && !waiting2),
    levelId: row.level_id || null,
    levelName: row.level_name || null,
    createdAt: row.created_at
  };
}

function discountDto(row) {
  return {
    id: row.id,
    planId: row.plan_id,
    tranche: row.tranche,
    kind: row.kind,
    value: Number(row.value),
    amount: money(row.amount),
    reason: row.reason || null,
    status: row.status,
    createdByName: row.by_prenom ? `${row.by_prenom} ${row.by_nom || ""}`.trim() : null,
    createdByRole: row.created_by_role,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at || null,
    cancelledByName: row.cancelled_prenom ? `${row.cancelled_prenom} ${row.cancelled_nom || ""}`.trim() : null,
    cancelReason: row.cancel_reason || null
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
  const profile = await studentRepo.ensureProfile(studentId);
  const levelId = profile.target_level_id || null;
  const tariff = await resolveTariff(countryId, levelId);
  if (!tariff) throw fail("Aucun tarif n'est défini pour ce parcours. Définissez-le d'abord dans Finance > Tarifs.", 400);
  await paymentRepo.createPlan({
    studentId,
    countryId,
    currency: tariff.currency,
    tranche1Due: tariff.tranche1,
    tranche2Due: tariff.tranche2,
    levelId: tariff.levelId,
    levelName: tariff.levelName
  });
  return paymentRepo.findPlan(studentId, countryId);
}

// Crée le plan à la fin de l'onboarding si le code n'en a pas déjà figé un.
async function ensurePlanForChoice(studentId, countryId, levelId) {
  const existing = await paymentRepo.findPlan(studentId, countryId);
  if (existing) return existing;
  const tariff = await resolveTariff(countryId, levelId);
  if (!tariff) return null;
  await paymentRepo.createPlan({
    studentId,
    countryId,
    currency: tariff.currency,
    tranche1Due: tariff.tranche1,
    tranche2Due: tariff.tranche2,
    levelId: tariff.levelId,
    levelName: tariff.levelName
  });
  return paymentRepo.findPlan(studentId, countryId);
}

// Le conseiller change la destination : l'argent encaissé reste, le reste suit le nouveau tarif.
async function retargetStudentPlan(studentId, countryId, levelId) {
  const tariff = await resolveTariff(countryId, levelId);
  if (!tariff) throw fail("Ce parcours n'a pas encore de tarif. Définissez-le dans Finance > Tarifs.", 400);
  const plans = await paymentRepo.listPlansForStudent(studentId);
  const sameCountry = plans.find((plan) => plan.country_id === countryId);
  const movable = plans.length === 1 ? plans[0] : null;
  const target = sameCountry || movable;
  const fields = {
    countryId,
    currency: tariff.currency,
    tranche1Due: tariff.tranche1,
    tranche2Due: tariff.tranche2,
    levelId: tariff.levelId,
    levelName: tariff.levelName
  };
  if (!target) {
    await paymentRepo.createPlan({ studentId, ...fields });
    return paymentRepo.findPlan(studentId, countryId);
  }
  const paid = cents(target.paid1) + cents(target.paid2);
  if (paid > 0 && target.currency !== tariff.currency) {
    throw fail("La monnaie du nouveau tarif est différente des paiements déjà encaissés.", 400);
  }
  let retargeted = target.id;
  try {
    await paymentRepo.retargetPlan(target.id, fields);
  } catch (error) {
    if (error.code !== "23505") throw error;
    const destination = await paymentRepo.findPlan(studentId, countryId);
    if (!destination) throw error;
    await paymentRepo.retargetPlan(destination.id, fields);
    retargeted = destination.id;
  }
  await refreshDiscounts(retargeted);
  return paymentRepo.findPlan(studentId, countryId);
}

async function assertStudentAccess(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  if (!canAccessStudent(auth, studentId, profile.assigned_sales_id)) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  return profile;
}

// Responsable Dossier : seulement l'état du paiement (soldé / en retard), jamais les montants.
function redactPlan(plan) {
  const hide = (tranche) => ({ due: 0, paid: 0, remaining: 0, complete: tranche.complete });
  return {
    ...plan,
    salesId: null,
    salesName: null,
    tranche1: hide(plan.tranche1),
    tranche2: hide(plan.tranche2),
    total: 0,
    paidTotal: 0,
    remainingTotal: 0,
    dueNow: 0
  };
}

async function summaryForStudent(auth, studentId) {
  const profile = await studentRepo.ensureProfile(studentId);
  const fullAccess = canAccessStudent(auth, studentId, profile.assigned_sales_id);
  if (!fullAccess && !(await canViewStudent(auth, studentId, profile.assigned_sales_id))) {
    throw fail("Vous n’avez pas accès à ce dossier.", 403);
  }
  const isAdmin = authRoles(auth).includes("ADMIN");
  const plans = (await paymentRepo.listPlansForStudent(studentId)).map(planDto);
  if (!fullAccess) return { plans: plans.map(redactPlan), payments: [], discounts: [], canCancel: false, canDiscount: false };
  const payments = (await paymentRepo.listPaymentsForStudent(studentId)).map(paymentDto);
  // Remises : réservées à l'équipe (l'étudiant ne voit que le montant net et la remise de chaque tranche).
  const canDiscount = isAdmin || authRoles(auth).includes("SALES");
  const discounts = canDiscount ? (await paymentRepo.listDiscountsForStudent(studentId)).map(discountDto) : [];
  return {
    plans,
    payments: isAdmin ? payments : payments.filter((p) => p.status === "ACTIVE"),
    discounts: isAdmin ? discounts : discounts.filter((d) => d.status === "ACTIVE"),
    canCancel: isAdmin,
    canDiscount
  };
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

  // Paiement partiel : la date limite promise à l'étudiant pour payer le reste est obligatoire.
  const remainingAfter = cents(state.remaining) - cents(amount);
  let deadline = null;
  if (remainingAfter > 0) {
    deadline = normalizeDeadline(payload.deadline);
    const existingDeadline = dateOnly(tranche === 1 ? plan.tranche1_deadline : plan.tranche2_deadline);
    if (!deadline && !existingDeadline) throw fail("Paiement partiel : indiquez la date limite pour payer le reste.", 400);
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
  // Tranche soldée : plus de date limite ; sinon la nouvelle date remplace l'ancienne.
  if (remainingAfter <= 0) await paymentRepo.setPlanDeadline(plan.id, tranche, null);
  else if (deadline) await paymentRepo.setPlanDeadline(plan.id, tranche, deadline);
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

// Accorde une remise sur une tranche (conseiller de l'étudiant ou admin). Le conseiller prévient
// l'admin par notification ; une nouvelle remise remplace la précédente de la même tranche.
async function applyDiscount(auth, studentId, payload) {
  const roles = authRoles(auth);
  const isAdmin = roles.includes("ADMIN");
  if (!isAdmin && !roles.includes("SALES")) throw fail("Action réservée à l'administrateur ou au conseiller.", 403);
  await assertStudentAccess(auth, studentId);

  const tranche = Number(payload.tranche);
  if (![1, 2].includes(tranche)) throw fail("Choisissez la tranche (1 ou 2).", 400);
  if (!payload.countryId) throw fail("Choisissez le pays concerné.", 400);
  const input = normalizeDiscount(payload);
  const plan = await ensurePlan(studentId, payload.countryId);

  const base = money(tranche === 1 ? plan.tranche1_base : plan.tranche2_base);
  const paid = money(tranche === 1 ? plan.paid1 : plan.paid2);
  const amount = discountAmount(base, input.kind, input.value);
  if (amount <= 0) throw fail("Cette remise est nulle : indiquez un pourcentage ou un montant plus élevé.", 400);
  // Jamais en dessous de ce qui est déjà encaissé : une remise ne rembourse personne.
  const maxDiscount = Math.max(0, cents(base) - cents(paid)) / 100;
  if (maxDiscount <= 0) throw fail(`La tranche ${tranche} est déjà entièrement payée : aucune remise possible.`, 409);
  if (cents(amount) > cents(maxDiscount)) {
    throw fail(`La remise (${formatAmount(amount, plan.currency)}) dépasse ce qui reste à payer sur la tranche ${tranche} : ${formatAmount(maxDiscount, plan.currency)} au maximum.`, 400);
  }

  const created = await paymentRepo.replaceDiscount({
    planId: plan.id,
    tranche,
    kind: input.kind,
    value: input.value,
    amount,
    reason: input.reason,
    createdBy: auth.sub,
    createdByRole: isAdmin ? "ADMIN" : "SALES"
  });
  // Tranche désormais soldée : plus de date limite à tenir.
  const after = cents(base) - cents(amount) - cents(paid);
  if (after <= 0) await paymentRepo.setPlanDeadline(plan.id, tranche, null);
  logger.info("Paiement : remise accordée", { discountId: created.id, plan: plan.id, tranche, kind: input.kind, value: input.value, amount, by: auth.sub });

  if (!isAdmin) {
    const student = await userRepo.findById(studentId);
    const seller = await userRepo.findById(auth.sub);
    const who = student ? `${student.prenom} ${student.nom}`.trim() : "l'étudiant";
    const sellerName = seller ? `${seller.prenom} ${seller.nom}`.trim() : "Un conseiller";
    await notificationService.notifyAdmins({
      type: "PAYMENT_DISCOUNT",
      title: `Remise accordée : ${who}`,
      body: `${sellerName} a accordé une remise de ${discountLabel(input.kind, input.value, plan.currency)} (−${formatAmount(amount, plan.currency)}) sur la tranche ${tranche} de ${who} (${plan.country_name}). À payer : ${formatAmount(base - amount, plan.currency)} au lieu de ${formatAmount(base, plan.currency)}.${input.reason ? ` Motif : ${input.reason}` : ""}`,
      link: `/admin/finance?student=${studentId}`
    });
  }
  return summaryForStudent(auth, studentId);
}

// Annulation d'une remise (admin) : le prix de la tranche redevient le prix catalogue.
async function cancelDiscount(auth, discountId, reason) {
  if (!authRoles(auth).includes("ADMIN")) throw fail("Seul l'administrateur peut annuler une remise.", 403);
  const trimmed = String(reason || "").trim().slice(0, 300);
  if (!trimmed) throw fail("Indiquez le motif de l'annulation.", 400);
  const discount = await paymentRepo.findDiscount(discountId);
  if (!discount) throw fail("Remise introuvable.", 404);
  if (discount.status !== "ACTIVE") throw fail("Cette remise est déjà annulée.", 409);
  const plan = await paymentRepo.findPlanById(discount.plan_id);
  await paymentRepo.cancelDiscount(discountId, { cancelledBy: auth.sub, reason: trimmed });
  logger.info("Paiement : remise annulée par l'admin", { discountId, plan: discount.plan_id, by: auth.sub });
  if (discount.created_by && discount.created_by_role === "SALES" && plan) {
    await notificationService.notify(discount.created_by, {
      type: "PAYMENT_DISCOUNT",
      title: `Remise annulée : ${plan.student_prenom || ""} ${plan.student_nom || ""}`.trim(),
      body: `L'administrateur a annulé votre remise sur la tranche ${discount.tranche} (${plan.country_name}). Motif : ${trimmed}`,
      link: `/conseiller/etudiants/${plan.student_id}`
    });
  }
  return summaryForStudent(auth, plan.student_id);
}

// Le prix catalogue du plan a changé (pays ou niveau modifié) : les remises en pourcentage suivent
// le nouveau prix ; une remise qui n'a plus de sens (prix à zéro) est annulée.
async function refreshDiscounts(planId) {
  const plan = await paymentRepo.findPlanById(planId);
  if (!plan) return;
  for (const discount of await paymentRepo.listActiveDiscounts(planId)) {
    const base = money(discount.tranche === 1 ? plan.tranche1_base : plan.tranche2_base);
    const amount = Math.min(discountAmount(base, discount.kind, discount.value), base);
    if (amount <= 0) {
      await paymentRepo.cancelDiscount(discount.id, { cancelledBy: null, reason: "Prix de la tranche modifié" });
    } else if (cents(amount) !== cents(discount.amount)) {
      await paymentRepo.updateDiscountAmount(discount, amount);
    }
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

// Correction de la date d'un paiement déjà enregistré (admin) : il change alors de mois dans les statistiques.
async function updatePaymentDate(auth, paymentId, rawDate) {
  if (!authRoles(auth).includes("ADMIN")) throw fail("Seul l'administrateur peut modifier la date d'un paiement.", 403);
  if (!rawDate) throw fail("Choisissez la nouvelle date du paiement.", 400);
  const paidAt = normalizeDate(rawDate);
  const payment = await paymentRepo.findPayment(paymentId);
  if (!payment) throw fail("Paiement introuvable.", 404);
  if (payment.status !== "ACTIVE") throw fail("Un paiement annulé ne peut pas être modifié.", 409);
  const before = dateOnly(payment.paid_at);
  await paymentRepo.updatePaymentDate(paymentId, paidAt);
  logger.info("Paiement : date modifiée par l'admin", { paymentId, receipt: payment.receipt_number, before, after: paidAt, by: auth.sub });
  return summaryForStudent(auth, payment.student_id);
}

// ── Code d'inscription : tranche 1 confirmée à la création ──

// Valide la confirmation d'encaissement saisie à la création du code. Renvoie
// null si le pays n'a pas de tarif (aucun paiement attendu).
async function prepareCodePayment(countryId, payment, levelId) {
  const tariff = await resolveTariff(countryId, levelId || null);
  if (!tariff) return null;
  const pricing = { currency: tariff.currency, tranche1_amount: tariff.tranche1, tranche2_amount: tariff.tranche2, levelId: tariff.levelId, levelName: tariff.levelName };

  // Remise facultative sur la tranche 1 : le client ne règle (et le conseiller n'encaisse) que le montant net.
  let discount = null;
  if (payment?.discount && String(payment.discount.value ?? "").trim() !== "") {
    const input = normalizeDiscount(payment.discount);
    const amount = discountAmount(pricing.tranche1_amount, input.kind, input.value);
    if (amount <= 0) throw fail("Cette remise est nulle : indiquez un pourcentage ou un montant plus élevé.", 400);
    if (cents(amount) > cents(pricing.tranche1_amount)) {
      throw fail(`La remise dépasse la tranche 1 (${formatAmount(pricing.tranche1_amount, pricing.currency)}).`, 400);
    }
    discount = { ...input, amount };
  }
  const net1 = (cents(pricing.tranche1_amount) - cents(discount?.amount || 0)) / 100;

  if (cents(net1) > 0) {
    if (!payment || payment.confirmed !== true) {
      throw fail(`Confirmez l'encaissement de la tranche 1 (${formatAmount(net1, pricing.currency)}) pour générer le code.`, 400);
    }
  }
  const paying = cents(net1) > 0;
  const method = paying ? normalizeMethod(payment.method) : null;
  const reference = paying ? await normalizeMethodReference(method, payment.reference) : null;

  // Montant encaissé : toute la tranche 1 par défaut, ou une partie (avec la date limite pour le reste).
  let paidAmount = null;
  let deadline = null;
  if (paying) {
    const full = money(net1);
    paidAmount = payment.amount === undefined || payment.amount === null || payment.amount === "" ? full : normalizeAmount(payment.amount, "Le montant encaissé");
    if (cents(paidAmount) > cents(full)) {
      throw fail(`Le montant encaissé dépasse la tranche 1 (${formatAmount(full, pricing.currency)}).`, 400);
    }
    if (cents(paidAmount) < cents(full)) {
      deadline = normalizeDeadline(payment.deadline);
      if (!deadline) throw fail("Paiement partiel : indiquez la date limite pour payer le reste de la tranche 1.", 400);
    }
  }
  return {
    paidAmount,
    deadline,
    currency: pricing.currency,
    tranche1: money(pricing.tranche1_amount),
    tranche2: money(pricing.tranche2_amount),
    discount,
    levelId: pricing.levelId,
    levelName: pricing.levelName,
    method,
    reference,
    // Date de l'encaissement : aujourd'hui par défaut, modifiable par le conseiller (jamais dans le futur).
    paidAt: paying ? normalizeDate(payment.paidAt) : null,
    // Le reçu est numéroté dès l'encaissement, pour être remis au client.
    receiptNumber: paying ? await paymentRepo.nextReceiptNumber() : null
  };
}

// Remise accordée à la création d'un code : l'admin est prévenu (l'étudiant n'a pas encore de compte).
async function notifyCodeDiscount(auth, { code, countryName, phone }, prepared) {
  if (!prepared?.discount) return;
  const roles = authRoles(auth);
  if (roles.includes("ADMIN") && !roles.includes("SALES")) return;
  const seller = await userRepo.findById(auth.sub);
  const sellerName = seller ? `${seller.prenom} ${seller.nom}`.trim() : "Un conseiller";
  const { discount, currency } = prepared;
  await notificationService.notifyAdmins({
    type: "PAYMENT_DISCOUNT",
    title: `Remise accordée sur le code ${code}`,
    body: `${sellerName} a accordé une remise de ${discountLabel(discount.kind, discount.value, currency)} (−${formatAmount(discount.amount, currency)}) sur la tranche 1 du code ${code} (${countryName || "pays non précisé"}${phone ? `, ${phone}` : ""}). Le client paiera ${formatAmount(prepared.tranche1 - discount.amount, currency)} au lieu de ${formatAmount(prepared.tranche1, currency)}.${discount.reason ? ` Motif : ${discount.reason}` : ""}`,
    link: "/admin/finance"
  });
}

// Appelé quand l'étudiant s'inscrit avec le code : crée son plan et enregistre
// la tranche 1 déjà encaissée.
async function applyCodePayment(studentId, claimed) {
  if (!claimed.country_id || claimed.payment_tranche1 === null || claimed.payment_tranche1 === undefined) return;
  // payment_tranche1 = prix catalogue ; la remise accordée à la création du code en est déduite.
  const codeDiscount = claimed.payment_discount_amount ? money(claimed.payment_discount_amount) : 0;
  const net1 = (cents(claimed.payment_tranche1) - cents(codeDiscount)) / 100;
  const plan = await paymentRepo.createPlan({
    studentId,
    countryId: claimed.country_id,
    currency: claimed.payment_currency,
    tranche1Due: net1,
    tranche2Due: claimed.payment_tranche2,
    tranche1Deadline: dateOnly(claimed.payment_deadline),
    levelId: claimed.prefill_level_id || null,
    levelName: claimed.prefill_target_level || null,
    tranche1Discount: codeDiscount
  });
  if (codeDiscount > 0) {
    try {
      await paymentRepo.insertDiscountRecord({
        planId: plan.id,
        tranche: 1,
        kind: claimed.payment_discount_kind,
        value: claimed.payment_discount_value,
        amount: codeDiscount,
        reason: claimed.payment_discount_reason,
        createdBy: claimed.sales_id,
        createdByRole: "SALES"
      });
    } catch (error) {
      logger.error("Remise du code : historique non enregistré", { message: error.message, plan: plan.id });
    }
  }
  if (cents(net1) > 0) {
    const created = await paymentRepo.createPayment({
      planId: plan.id,
      studentId,
      tranche: 1,
      amount: claimed.payment_paid_amount !== null && claimed.payment_paid_amount !== undefined ? claimed.payment_paid_amount : net1,
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
  const [due, blocked] = await Promise.all([
    query("SELECT COALESCE(SUM(amount_dinar), 0)::float AS total FROM commission_earnings WHERE payout_id IS NULL"),
    query(
      `SELECT COUNT(*)::int AS count
       FROM university_applications ua
       JOIN payment_plans pl ON pl.student_id = ua.student_id AND pl.country_id = ua.country_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS p2 FROM student_payments
         WHERE plan_id = pl.id AND tranche = 2 AND status = 'ACTIVE'
       ) pp ON TRUE
       WHERE ua.visa_status = 'PREPARATION' AND pl.tranche2_due > pp.p2`
    )
  ]);
  return {
    collected,
    remaining,
    lateCount: plans.filter((p) => p.late).length,
    planCount: plans.length,
    commissionsDue: money(due.rows[0].total),
    visaBlocked: blocked.rows[0].count,
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
  // Conseiller connecté : ses étudiants et ceux qu'il remplace pendant un congé.
  if (filters.handledBy) plans = plans.filter((p) => leaveCover.handles(filters.handledBy, p.salesId, p.studentId, "SALES"));
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
  applyDiscount,
  cancelDiscount,
  notifyCodeDiscount,
  cancelPayment,
  updatePaymentDate,
  prepareCodePayment,
  applyCodePayment,
  resolveTariff,
  ensurePlanForChoice,
  retargetStudentPlan,
  assertVisaPaid,
  visaPaymentDue,
  registrationPaymentDue,
  assertRegistrationPaid,
  overview,
  stats,
  listPlans,
  listJournal
};
