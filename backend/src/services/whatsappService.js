const crypto = require("crypto");
const env = require("../config/env");
const logger = require("../logger");
const repo = require("../repositories/whatsappRepository");
const notificationService = require("./notificationService");
const autoAssign = require("./autoAssignService");

// Dernières traces (en mémoire, remises à zéro au redémarrage) : alimentent le diagnostic WhatsApp.
const trace = { inbound: null, status: null, send: null };

const maskPhone = (phone) => (phone && phone.length > 6 ? `${phone.slice(0, 4)}…${phone.slice(-3)}` : "***");

const MAX_TEXT_LENGTH = 4096;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MEDIA_TYPES = ["image", "document", "audio", "video", "sticker"];
const MEDIA_PLACEHOLDER = "[Fichier reçu — les documents doivent être déposés sur la plateforme, pas par WhatsApp]";

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function authRoles(auth) {
  return Array.isArray(auth?.roles) && auth.roles.length ? auth.roles : [auth?.role].filter(Boolean);
}

function isAdmin(auth) {
  return authRoles(auth).includes("ADMIN");
}

// Numéro au format Meta : chiffres seuls, sans "00" initial ; un numéro
// tunisien local (8 chiffres) reçoit l'indicatif 216.
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").replace(/^00/, "");
  return digits.length === 8 ? `216${digits}` : digits;
}

// ── Webhook ─────────────────────────────────────────────────────────────

function isValidSignature(rawBody, signatureHeader) {
  if (!rawBody || !signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", env.whatsapp.appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function extractBody(message) {
  switch (message.type) {
    case "text":
      return message.text?.body || "";
    case "button":
      return message.button?.text || "";
    case "interactive":
      return message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "";
    case "location":
      return "[Localisation partagée]";
    default:
      return MEDIA_TYPES.includes(message.type) ? MEDIA_PLACEHOLDER : "[message non pris en charge]";
  }
}

function contactLabel(conversation) {
  return fullName(conversation.student_prenom, conversation.student_nom)
    || conversation.profile_name
    || `+${conversation.phone}`;
}

// Attribue un responsable au contact s'il n'en a pas d'actif : le
// conseiller de l'étudiant lié d'abord, sinon le sales actif le moins
// chargé en conversations WhatsApp. Aucun sales actif → reste "non
// attribuée", visible par l'admin (qui est prévenu).
async function ensureOwner(contactId, { isNew = false } = {}) {
  const conversation = await repo.findConversation(contactId);
  const before = conversation.owner_id;
  let after = before;

  if (!before || !(await repo.isActiveSales(before))) {
    after = null;
    if (conversation.student_id) {
      const student = await repo.findStudentForLink(conversation.student_id);
      if (student?.assigned_sales_id && (await repo.isActiveSales(student.assigned_sales_id))) {
        after = student.assigned_sales_id;
      }
    }
    if (!after) {
      // Pourcentages si le mode est activé dans Paramètres, sinon le moins chargé.
      after = await autoAssign.pickOrFallback("whatsapp", () => repo.findLeastLoadedActiveSales());
    }
    await repo.setAssignedSales(contactId, after);
  }

  // Conversation en sourdine : l'attribution se fait, mais sans notification.
  if (conversation.muted_at) return;

  if (after && (isNew || after !== before)) {
    await notificationService.notify(after, {
      type: "WHATSAPP_ASSIGNED",
      title: "Nouvelle conversation WhatsApp",
      body: `${contactLabel(conversation)} vous a été attribué(e) sur WhatsApp.`,
      link: "/whatsapp"
    });
  } else if (!after && (isNew || before)) {
    await notificationService.notifyAdmins({
      type: "WHATSAPP_UNASSIGNED",
      title: "Conversation WhatsApp non attribuée",
      body: `${contactLabel(conversation)} a écrit mais aucun conseiller actif n'est disponible.`,
      link: "/whatsapp"
    });
  }
}

async function handleIncomingMessage(message, profileNames, metadata = {}) {
  if (message.type === "reaction") return;

  const phone = normalizePhone(message.from);
  if (!phone) return;

  const known = await repo.findContactByPhone(phone);
  if (known?.blocked_at) return;

  const contact = await repo.upsertContact(phone, profileNames[message.from]);
  const isNew = !contact.last_message_at;

  // Numéro de l'agence auquel le client a écrit : les réponses repartiront de ce numéro.
  if (metadata.phone_number_id) {
    if (contact.wa_phone_number_id !== metadata.phone_number_id) {
      await repo.setReceivingNumber(contact.id, metadata.phone_number_id, metadata.display_phone_number);
    }
    if (env.whatsapp.phoneNumberId && metadata.phone_number_id !== env.whatsapp.phoneNumberId) {
      logger.warn("WhatsApp : le message arrive sur un autre numéro que WHATSAPP_PHONE_NUMBER_ID", {
        receivedOn: metadata.phone_number_id,
        configured: env.whatsapp.phoneNumberId
      });
    }
  }
  trace.inbound = { at: new Date().toISOString(), phoneNumberId: metadata.phone_number_id || null, displayPhone: metadata.display_phone_number || null, from: maskPhone(phone) };
  if (!contact.student_id) {
    const student = await repo.findStudentByPhone(phone);
    if (student) await repo.setStudent(contact.id, student.id);
  }

  const createdAt = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();
  const inserted = await repo.insertMessage({
    contactId: contact.id,
    waMessageId: message.id,
    direction: "in",
    type: message.type || "unknown",
    body: extractBody(message),
    status: "received",
    createdAt
  });
  if (!inserted) return;

  await repo.touchInbound(contact.id, createdAt);
  await ensureOwner(contact.id, { isNew });
}

async function handleStatus(status) {
  if (!["sent", "delivered", "read", "failed"].includes(status.status)) return;
  const errorInfo = status.errors?.[0];
  const error = errorInfo ? errorInfo.error_data?.details || errorInfo.message || errorInfo.title : null;
  await repo.updateStatus(status.id, status.status, status.status === "failed" ? error : null);
  trace.status = { at: new Date().toISOString(), status: status.status, code: errorInfo?.code || null, error: error || null };
  if (status.status === "failed") {
    logger.warn("WhatsApp : message non délivré", { waMessageId: status.id, code: errorInfo?.code, title: errorInfo?.title, details: error });
  } else {
    logger.info("WhatsApp : statut de livraison reçu", { waMessageId: status.id, status: status.status });
  }
}

async function processWebhook(payload) {
  for (const entry of payload?.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value || {};
      const profileNames = {};
      for (const contact of value.contacts || []) {
        if (contact.wa_id) profileNames[contact.wa_id] = contact.profile?.name || null;
      }
      for (const message of value.messages || []) {
        try {
          await handleIncomingMessage(message, profileNames, value.metadata || {});
        } catch (error) {
          logger.error("WhatsApp : échec du traitement d'un message entrant", { message: error.message, waMessageId: message.id });
        }
      }
      for (const status of value.statuses || []) {
        try {
          await handleStatus(status);
        } catch (error) {
          logger.error("WhatsApp : échec de la mise à jour d'un statut", { message: error.message, waMessageId: status.id });
        }
      }
    }
  }
}

// ── API interne ─────────────────────────────────────────────────────────

function windowInfo(lastInboundAt) {
  if (!lastInboundAt) return { windowOpen: false, windowExpiresAt: null };
  const expiresAt = new Date(new Date(lastInboundAt).getTime() + WINDOW_MS);
  return { windowOpen: expiresAt.getTime() > Date.now(), windowExpiresAt: expiresAt.toISOString() };
}

function fullName(prenom, nom) {
  return prenom ? `${prenom} ${nom || ""}`.trim() : null;
}

function mapConversation(row) {
  return {
    id: row.id,
    phone: row.phone,
    profileName: row.profile_name,
    studentId: row.student_id,
    studentName: fullName(row.student_prenom, row.student_nom),
    ownerId: row.owner_id,
    ownerName: fullName(row.owner_prenom, row.owner_nom),
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
    // Un message masqué ne ressort jamais, pas même dans l'aperçu de la liste.
    lastBody: row.last_hidden ? "" : row.last_body || "",
    lastHidden: Boolean(row.last_hidden),
    lastDirection: row.last_direction || null,
    lastStatus: row.last_status || null,
    unread: row.unread || 0,
    muted: Boolean(row.muted_at),
    blocked: Boolean(row.blocked_at),
    ...windowInfo(row.last_inbound_at)
  };
}

// forAdmin : seul l'admin voit qu'un message a été envoyé par lui au nom d'un
// conseiller ; les conseillers voient simplement le nom affiché.
function mapMessage(row, { forAdmin = false } = {}) {
  const hidden = Boolean(row.hidden_at);
  return {
    sentByAdmin: forAdmin ? Boolean(row.sent_by_admin) : undefined,
    id: row.id,
    direction: row.direction,
    type: row.type,
    body: hidden ? "" : row.body || "",
    hidden,
    hiddenByName: hidden ? fullName(row.hidden_prenom, row.hidden_nom) : null,
    status: row.status,
    error: row.error,
    senderName: fullName(row.sender_prenom, row.sender_nom),
    createdAt: new Date(row.created_at).toISOString()
  };
}

async function getAccessibleConversation(auth, contactId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(contactId))) throw fail("Conversation introuvable.", 404);
  const conversation = await repo.findConversation(contactId);
  if (!conversation) throw fail("Conversation introuvable.", 404);
  if (!isAdmin(auth) && conversation.owner_id !== auth.sub) throw fail("Cette conversation est gérée par un autre conseiller.", 403);
  return conversation;
}

async function listConversations(auth, search) {
  const rows = await repo.listConversations({
    userId: auth.sub,
    ownerId: isAdmin(auth) ? null : auth.sub,
    // Admin : un message déjà répondu par un conseiller n'est plus « non lu ».
    answeredIsRead: isAdmin(auth),
    search: String(search || "").trim().slice(0, 80)
  });
  return rows.map(mapConversation);
}

async function getMessages(auth, contactId, { before, limit }) {
  await getAccessibleConversation(auth, contactId);
  const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;
  const rows = await repo.listMessages(contactId, { before: beforeDate, limit: pageSize });
  if (!beforeDate) await repo.markRead(contactId, auth.sub);
  return { messages: rows.map((row) => mapMessage(row, { forAdmin: isAdmin(auth) })), hasMore: rows.length === pageSize };
}

// Meta ne permet pas de supprimer un message envoyé : on le masque seulement
// dans l'application. L'étudiant le voit toujours sur son téléphone.
async function hideMessage(auth, contactId, messageId) {
  await getAccessibleConversation(auth, contactId);
  if (!/^[0-9a-f-]{36}$/i.test(String(messageId))) throw fail("Message introuvable.", 404);
  const message = await repo.findMessage(contactId, messageId);
  if (!message) throw fail("Message introuvable.", 404);
  if (message.direction !== "out") throw fail("Seuls les messages envoyés depuis l'application peuvent être masqués.", 400);
  if (!message.hidden_at) await repo.hideMessage(messageId, auth.sub);
  return { hidden: true };
}

function metaErrorToHttp(metaError) {
  const code = metaError?.code;
  if (code === 131047) {
    return fail("Plus de 24 h depuis le dernier message de l'étudiant : il doit vous réécrire avant que vous puissiez répondre.", 409);
  }
  if (code === 131056) {
    return fail("Trop de messages envoyés à ce contact en peu de temps. Réessayez dans quelques instants.", 429);
  }
  const detail = metaError?.error_data?.details || metaError?.message || "Erreur inconnue.";
  return fail(`WhatsApp a refusé l'envoi : ${detail}`, 502);
}

async function sendText(auth, contactId, text) {
  // Conseillers et admin (qui supervise et peut répondre à la place d'un conseiller).
  if (!authRoles(auth).some((role) => role === "SALES" || role === "ADMIN")) {
    throw fail("Seuls les conseillers et l'admin peuvent envoyer un message WhatsApp.", 403);
  }
  const body = String(text || "").trim();
  if (!body) throw fail("Le message est vide.", 400);
  if (body.length > MAX_TEXT_LENGTH) throw fail(`Message trop long (${MAX_TEXT_LENGTH} caractères maximum).`, 400);

  const conversation = await getAccessibleConversation(auth, contactId);
  if (conversation.blocked_at) {
    throw fail("Ce contact est bloqué : débloquez-le pour lui écrire.", 409);
  }
  if (!windowInfo(conversation.last_inbound_at).windowOpen) {
    throw fail("Plus de 24 h depuis le dernier message de l'étudiant : il doit vous réécrire avant que vous puissiez répondre.", 409);
  }
  // Les réponses partent du numéro auquel le client a écrit (sinon du numéro configuré).
  const fromNumberId = conversation.wa_phone_number_id || env.whatsapp.phoneNumberId;
  if (!env.whatsapp.token || !fromNumberId) {
    throw fail("WhatsApp n'est pas configuré sur ce serveur (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).", 503);
  }

  let response;
  let data;
  try {
    response = await fetch(`https://graph.facebook.com/${env.whatsapp.graphVersion}/${fromNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsapp.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: conversation.phone,
        type: "text",
        text: { preview_url: false, body }
      })
    });
    data = await response.json().catch(() => ({}));
  } catch (error) {
    logger.error("WhatsApp : Meta injoignable", { message: error.message });
    throw fail("Impossible de joindre WhatsApp. Réessayez dans un instant.", 502);
  }

  if (!response.ok) {
    logger.error("WhatsApp : envoi refusé par Meta", { error: data.error, contactId, from: fromNumberId, to: maskPhone(conversation.phone) });
    trace.send = { at: new Date().toISOString(), ok: false, from: fromNumberId, code: data.error?.code || null, error: data.error?.message || null };
    throw metaErrorToHttp(data.error);
  }
  logger.info("WhatsApp : message accepté par Meta", { waMessageId: data.messages?.[0]?.id, from: fromNumberId, to: maskPhone(conversation.phone) });
  trace.send = { at: new Date().toISOString(), ok: true, from: fromNumberId, waMessageId: data.messages?.[0]?.id || null };

  const inserted = await repo.insertMessage({
    contactId,
    waMessageId: data.messages?.[0]?.id,
    direction: "out",
    type: "text",
    body,
    status: "sent",
    sentBy: auth.sub,
    // L'admin qui répond dans la conversation d'un conseiller écrit au nom de ce
    // conseiller (l'auteur réel reste en base). Sur WhatsApp l'étudiant ne voit
    // de toute façon que le numéro de l'agence, jamais un nom d'employé.
    sentAs: isAdmin(auth) && conversation.owner_id && conversation.owner_id !== auth.sub ? conversation.owner_id : null
  });
  await repo.touchOutbound(contactId);
  await repo.markRead(contactId, auth.sub);
  const sentRow = (await repo.listMessages(contactId, { before: null, limit: 5 })).find((m) => m.id === inserted.id) || inserted;
  return mapMessage(sentRow, { forAdmin: isAdmin(auth) });
}

// Diagnostic (admin) : configuration, numéro d'envoi vérifié auprès de Meta, numéros de réception vus,
// accusés de livraison des dernières 24 h et conseils si quelque chose cloche.
async function diagnostic(auth) {
  if (!isAdmin(auth)) throw fail("Réservé à l'administrateur.", 403);
  const config = {
    tokenSet: Boolean(env.whatsapp.token),
    appSecretSet: Boolean(env.whatsapp.appSecret),
    verifyTokenSet: Boolean(env.whatsapp.verifyToken),
    phoneNumberId: env.whatsapp.phoneNumberId || null,
    graphVersion: env.whatsapp.graphVersion
  };

  let sender = null;
  if (config.tokenSet && config.phoneNumberId) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/${env.whatsapp.graphVersion}/${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`,
        { headers: { Authorization: `Bearer ${env.whatsapp.token}` } }
      );
      const data = await response.json().catch(() => ({}));
      sender = response.ok
        ? { displayPhone: data.display_phone_number || null, verifiedName: data.verified_name || null, quality: data.quality_rating || null, status: data.status || null }
        : { error: data.error?.message || `Meta a répondu ${response.status}`, code: data.error?.code || null };
    } catch (error) {
      sender = { error: `Meta injoignable : ${error.message}` };
    }
  }

  const [receiving, outbound] = await Promise.all([repo.listReceivingNumbers(), repo.outboundStats()]);
  const counts = Object.fromEntries(outbound.counts.map((row) => [row.status, row.n]));
  const warnings = [];
  if (!config.tokenSet) warnings.push("WHATSAPP_TOKEN est vide : aucun message ne peut être envoyé.");
  if (!config.phoneNumberId) warnings.push("WHATSAPP_PHONE_NUMBER_ID est vide : le numéro d'envoi n'est pas défini.");
  if (sender?.error) warnings.push(`Le jeton ne peut pas lire le numéro d'envoi : ${sender.error}`);
  const other = receiving.find((r) => r.wa_phone_number_id !== config.phoneNumberId);
  if (config.phoneNumberId && other) {
    warnings.push(
      `Des clients écrivent au numéro ${other.wa_display_phone || other.wa_phone_number_id}, mais WHATSAPP_PHONE_NUMBER_ID pointe vers ${sender?.displayPhone || config.phoneNumberId}. Les réponses des nouvelles conversations partent désormais du numéro du client ; vérifiez que le jeton a accès à ce numéro.`
    );
  }
  if ((counts.sent || 0) > 0 && !(counts.delivered || counts.read) && !trace.status) {
    warnings.push("Des messages sont « envoyés » mais aucun accusé de livraison n'est reçu : vérifiez que le webhook est abonné au champ « messages » (il porte aussi les statuts) et que WHATSAPP_APP_SECRET est correct.");
  }
  if ((counts.failed || 0) > 0) warnings.push(`${counts.failed} message(s) non délivré(s) sur les dernières 24 h : voir les erreurs ci-dessous.`);

  return {
    config,
    sender,
    receiving: receiving.map((r) => ({ phoneNumberId: r.wa_phone_number_id, displayPhone: r.wa_display_phone, contacts: r.contacts, lastInboundAt: r.last_inbound_at })),
    outbound24h: { sent: counts.sent || 0, delivered: counts.delivered || 0, read: counts.read || 0, failed: counts.failed || 0 },
    recentFailures: outbound.failed.map((row) => ({ at: row.created_at, to: maskPhone(row.phone), error: row.error })),
    last: trace,
    warnings
  };
}

async function linkStudent(auth, contactId, studentId) {
  await getAccessibleConversation(auth, contactId);

  if (studentId === null) {
    await repo.setStudent(contactId, null);
    return mapConversationById(auth, contactId);
  }

  const student = await repo.findStudentForLink(String(studentId));
  if (!student) throw fail("Étudiant introuvable.", 404);
  if (!isAdmin(auth) && student.assigned_sales_id !== auth.sub) {
    throw fail("Vous ne pouvez lier une conversation qu'à l'un de vos étudiants.", 403);
  }

  await repo.setStudent(contactId, student.id);
  // La conversation suit le conseiller de l'étudiant.
  if (student.assigned_sales_id && (await repo.isActiveSales(student.assigned_sales_id))) {
    await repo.setAssignedSales(contactId, student.assigned_sales_id);
  }
  return mapConversationById(auth, contactId);
}

// Sourdine : la conversation continue de recevoir les messages mais n'alerte plus personne.
async function setMuted(auth, contactId, muted) {
  await getAccessibleConversation(auth, contactId);
  await repo.setMuted(contactId, muted ? auth.sub : null);
  return mapConversationById(auth, contactId);
}

// Blocage : les nouveaux messages de ce numéro sont ignorés et personne ne peut lui écrire.
async function setBlocked(auth, contactId, blocked) {
  await getAccessibleConversation(auth, contactId);
  await repo.setBlocked(contactId, blocked ? auth.sub : null);
  return mapConversationById(auth, contactId);
}

async function assignOwner(auth, contactId, salesId) {
  if (!isAdmin(auth)) throw fail("Seul l'administrateur peut réattribuer une conversation.", 403);
  const conversation = await getAccessibleConversation(auth, contactId);

  if (conversation.student_id) {
    const student = await repo.findStudentForLink(conversation.student_id);
    if (student?.assigned_sales_id && (await repo.isActiveSales(student.assigned_sales_id))) {
      throw fail("Cette conversation suit le conseiller de l'étudiant lié : réaffectez l'étudiant pour la déplacer.", 409);
    }
  }
  if (salesId !== null && !(await repo.isActiveSales(String(salesId)))) {
    throw fail("Conseiller introuvable ou inactif.", 400);
  }
  await repo.setAssignedSales(contactId, salesId);
  return mapConversationById(auth, contactId);
}

async function mapConversationById(auth, contactId) {
  const [row] = await repo.listConversations({ userId: auth.sub, ownerId: null, search: "", contactId, answeredIsRead: isAdmin(auth) });
  return row ? mapConversation(row) : null;
}

async function unreadCount(auth) {
  return repo.unreadCount({ userId: auth.sub, ownerId: isAdmin(auth) ? null : auth.sub, answeredIsRead: isAdmin(auth) });
}

// Un étudiant s'inscrit avec un code envoyé sur WhatsApp : sa conversation
// est liée à son compte et suit son conseiller. Ne fait jamais échouer
// l'inscription.
async function attachStudentFromCode(contactId, studentId) {
  try {
    await repo.setStudent(contactId, studentId);
    const student = await repo.findStudentForLink(studentId);
    if (student?.assigned_sales_id && (await repo.isActiveSales(student.assigned_sales_id))) {
      await repo.setAssignedSales(contactId, student.assigned_sales_id);
    }
  } catch (error) {
    logger.error("WhatsApp : échec de la liaison contact ↔ étudiant après inscription", { message: error.message, contactId });
  }
}

// À l'inscription : si ce numéro a déjà une conversation WhatsApp non liée,
// elle est rattachée tout de suite au nouveau compte.
async function linkStudentByPhone(studentId, rawPhone) {
  try {
    const contact = await repo.findContactByPhone(normalizePhone(rawPhone));
    if (contact && !contact.student_id) await attachStudentFromCode(contact.id, studentId);
  } catch (error) {
    logger.error("WhatsApp : échec de la liaison par numéro à l'inscription", { message: error.message });
  }
}

// ── Cycle de vie des sales ──────────────────────────────────────────────

async function onSalesTransferred(fromSalesId, toSalesId) {
  return repo.reassignAllFromSales(fromSalesId, toSalesId);
}

// Un sales passe inactif : ses conversations (directes, ou via ses
// étudiants liés) n'ont plus de responsable actif et sont redistribuées
// une à une au sales actif le moins chargé.
async function onSalesDeactivated(salesId) {
  for (const contactId of await repo.listContactIdsAssignedTo(salesId)) {
    await repo.setAssignedSales(contactId, null);
  }
  await distributeOrphans();
}

// Un sales devient disponible (création, réactivation) : les
// conversations en attente de responsable sont réparties.
async function distributeOrphans() {
  const contactIds = await repo.listOrphanContactIds();
  for (const contactId of contactIds) {
    await ensureOwner(contactId);
  }
}

module.exports = {
  normalizePhone,
  getAccessibleConversation,
  attachStudentFromCode,
  linkStudentByPhone,
  isValidSignature,
  processWebhook,
  listConversations,
  getMessages,
  sendText,
  hideMessage,
  diagnostic,
  setMuted,
  setBlocked,
  linkStudent,
  assignOwner,
  unreadCount,
  onSalesTransferred,
  onSalesDeactivated,
  distributeOrphans
};
