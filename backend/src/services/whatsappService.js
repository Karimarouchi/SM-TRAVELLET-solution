const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const logger = require("../logger");
const repo = require("../repositories/whatsappRepository");
const notificationService = require("./notificationService");
const settings = require("../repositories/settingsRepository");
const { parseWorkHours, zonedParts, zonedLocalToUtc, addDays } = require("./businessHours");
const autoAssign = require("./autoAssignService");

// Dernières traces (en mémoire, remises à zéro au redémarrage) : alimentent le diagnostic WhatsApp.
const trace = { inbound: null, status: null, send: null };

const maskPhone = (phone) => (phone && phone.length > 6 ? `${phone.slice(0, 4)}…${phone.slice(-3)}` : "***");

const MAX_TEXT_LENGTH = 4096;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MEDIA_TYPES = ["image", "document", "audio", "video", "sticker"];
const MEDIA_PLACEHOLDER = "[Fichier reçu mais impossible à ouvrir ici — demandez au client de le renvoyer]";

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

// ── Fichiers reçus (photos, vocaux, vidéos, documents) ───────────────────
const MAX_INBOUND_BYTES = 25 * 1024 * 1024;
const MIME_EXTENSIONS = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr", "audio/opus": "opus",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "application/pdf": "pdf", "application/msword": "doc", "application/vnd.ms-excel": "xls", "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt"
};

// Meta ne garde le fichier que peu de temps et son adresse expire vite : on le télécharge dès l'arrivée du message.
async function downloadInboundMedia(mediaId) {
  const headers = { Authorization: `Bearer ${env.whatsapp.token}` };
  const info = await fetch(`https://graph.facebook.com/${env.whatsapp.graphVersion}/${mediaId}`, { headers });
  const meta = await info.json().catch(() => ({}));
  if (!info.ok || !meta.url) throw new Error(meta.error?.message || `Meta a répondu ${info.status}`);
  if (meta.file_size && Number(meta.file_size) > MAX_INBOUND_BYTES) throw new Error("Fichier trop volumineux");
  const file = await fetch(meta.url, { headers });
  if (!file.ok) throw new Error(`Téléchargement refusé (${file.status})`);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_INBOUND_BYTES) throw new Error("Fichier vide ou trop volumineux");
  return { buffer, mime: String(meta.mime_type || file.headers.get("content-type") || "application/octet-stream").split(";")[0].trim().toLowerCase() };
}

// Fichier joint d'un message reçu : téléchargé et conservé sur le serveur. En cas d'échec, le message reste avec un texte de repli.
async function fetchInboundMedia(message) {
  const media = message[message.type];
  if (!media?.id || !env.whatsapp.token) return null;
  try {
    const { buffer, mime } = await downloadInboundMedia(media.id);
    const ext = MIME_EXTENSIONS[mime] || "bin";
    fs.mkdirSync(WA_MEDIA_DIR, { recursive: true });
    const stored = `wa_in_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
    fs.writeFileSync(path.join(WA_MEDIA_DIR, stored), buffer);
    const kind = mediaKindOf(mime);
    const name = cleanFileName(media.filename, kind === "image" ? `photo.${ext}` : kind === "audio" ? `message-vocal.${ext}` : kind === "video" ? `video.${ext}` : `document.${ext}`);
    const caption = String(media.caption || "").trim();
    const label = kind === "image" ? IMAGE_LABEL : kind === "audio" ? AUDIO_LABEL : kind === "video" ? VIDEO_LABEL : documentLabel(name);
    return { mediaPath: stored, mediaName: name, mediaMime: mime, body: caption || label };
  } catch (error) {
    logger.warn("WhatsApp : fichier reçu non téléchargé", { type: message.type, message: error.message });
    return null;
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
  // Photo, vocal, vidéo ou document : le fichier est téléchargé (sauf si Meta renvoie un message déjà reçu).
  const downloaded = MEDIA_TYPES.includes(message.type) && !(await repo.messageExists(message.id)) ? await fetchInboundMedia(message) : null;
  const inserted = await repo.insertMessage({
    contactId: contact.id,
    waMessageId: message.id,
    direction: "in",
    type: message.type || "unknown",
    body: downloaded ? downloaded.body : extractBody(message),
    status: "received",
    createdAt,
    mediaPath: downloaded?.mediaPath || null,
    mediaName: downloaded?.mediaName || null,
    mediaMime: downloaded?.mediaMime || null
  });
  if (!inserted) return;

  await repo.touchInbound(contact.id, createdAt);
  await ensureOwner(contact.id, { isNew });
  // Jour non travaillé : réponse automatique (sans jamais bloquer la réception du message).
  await maybeAutoReply(contact.id);
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
// Texte de repli (aperçu de la liste) quand un fichier est envoyé sans légende.
const IMAGE_LABEL = "📷 Photo";
const AUDIO_LABEL = "🎤 Message vocal";
const VIDEO_LABEL = "🎬 Vidéo";
const documentLabel = (name) => `📄 ${name}`;
const isMediaLabel = (body) => [IMAGE_LABEL, AUDIO_LABEL, VIDEO_LABEL].includes(body) || String(body || "").startsWith("📄 ");

// Famille d'un fichier d'après son type : image, vocal / audio, vidéo ou document.
const mediaKindOf = (mime) => (/^image\//.test(mime || "") ? "image" : /^audio\//.test(mime || "") ? "audio" : /^video\//.test(mime || "") ? "video" : "document");

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
    senderName: row.is_auto ? "Message automatique" : fullName(row.sender_prenom, row.sender_nom),
    auto: Boolean(row.is_auto),
    // Fichier joint : jamais le chemin du serveur, seulement de quoi l'afficher.
    media: row.media_name
      ? { name: row.media_name, mime: row.media_mime || "", kind: mediaKindOf(row.media_mime) }
      : null,
    caption: row.media_name && !isMediaLabel(row.body) ? row.body || "" : "",
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

// Envoi d'un message à Meta, depuis le numéro auquel le client a écrit (sinon le numéro configuré).
// Renvoie l'identifiant WhatsApp du message ; toute erreur est expliquée en clair.
async function postToMeta(conversation, contactId, payload) {
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
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: conversation.phone, ...payload })
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
  return data.messages?.[0]?.id || null;
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
  const waMessageId = await postToMeta(conversation, contactId, { type: "text", text: { preview_url: false, body } });

  const inserted = await repo.insertMessage({
    contactId,
    waMessageId,
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

// ── Fichiers envoyés (images et documents) ───────────────────────────────
const WA_MEDIA_DIR = path.join(__dirname, "../../uploads/whatsapp");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // limite de Meta pour les images
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;

// Formats acceptés par WhatsApp. « signature » = octets de début du fichier, vérifiés pour ne pas se fier au seul nom.
const MEDIA_FORMATS = {
  "image/jpeg": { ext: "jpg", kind: "image", signature: [[0xff, 0xd8, 0xff]] },
  "image/png": { ext: "png", kind: "image", signature: [[0x89, 0x50, 0x4e, 0x47]] },
  "application/pdf": { ext: "pdf", kind: "document", signature: [[0x25, 0x50, 0x44, 0x46]] },
  "application/msword": { ext: "doc", kind: "document", signature: [[0xd0, 0xcf, 0x11, 0xe0]] },
  "application/vnd.ms-excel": { ext: "xls", kind: "document", signature: [[0xd0, 0xcf, 0x11, 0xe0]] },
  "application/vnd.ms-powerpoint": { ext: "ppt", kind: "document", signature: [[0xd0, 0xcf, 0x11, 0xe0]] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: "docx", kind: "document", signature: [[0x50, 0x4b]] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: "xlsx", kind: "document", signature: [[0x50, 0x4b]] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: "pptx", kind: "document", signature: [[0x50, 0x4b]] },
  "text/plain": { ext: "txt", kind: "document", signature: null }
};

function cleanFileName(name, fallback) {
  const base = String(name || "").replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 120);
  return base || fallback;
}

// Envoi d'une image ou d'un document (avec légende facultative), dans la fenêtre de 24 h comme un texte.
async function sendMedia(auth, contactId, { file, filename, caption }) {
  if (!authRoles(auth).some((role) => role === "SALES" || role === "ADMIN")) {
    throw fail("Seuls les conseillers et l'admin peuvent envoyer un message WhatsApp.", 403);
  }
  const match = String(file || "").match(/^data:([^;,]+);base64,/);
  if (!match) throw fail("Aucun fichier fourni.", 400);
  const mime = match[1].toLowerCase();
  const format = MEDIA_FORMATS[mime];
  if (!format) throw fail("Format non pris en charge par WhatsApp : images JPEG ou PNG, PDF, Word, Excel, PowerPoint ou texte.", 400);

  const buffer = Buffer.from(String(file).slice(match[0].length), "base64");
  if (!buffer.length) throw fail("Le fichier est vide.", 400);
  const limit = format.kind === "image" ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
  if (buffer.length > limit) {
    throw fail(`Fichier trop lourd : ${format.kind === "image" ? "5 Mo" : "16 Mo"} au maximum pour ${format.kind === "image" ? "une image" : "un document"}.`, 400);
  }
  if (format.signature && !format.signature.some((sig) => sig.every((byte, i) => buffer[i] === byte))) {
    throw fail("Le contenu du fichier ne correspond pas à son format.", 400);
  }

  const text = String(caption || "").trim().slice(0, 1024);
  const name = cleanFileName(filename, `${format.kind === "image" ? "image" : "document"}.${format.ext}`);

  const conversation = await getAccessibleConversation(auth, contactId);
  if (conversation.blocked_at) throw fail("Ce contact est bloqué : débloquez-le pour lui écrire.", 409);
  if (!windowInfo(conversation.last_inbound_at).windowOpen) {
    throw fail("Plus de 24 h depuis le dernier message de l'étudiant : il doit vous réécrire avant que vous puissiez répondre.", 409);
  }
  const fromNumberId = conversation.wa_phone_number_id || env.whatsapp.phoneNumberId;
  if (!env.whatsapp.token || !fromNumberId) {
    throw fail("WhatsApp n'est pas configuré sur ce serveur (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).", 503);
  }

  // 1) Le fichier est déposé chez Meta, qui renvoie un identifiant de média.
  let mediaId;
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mime);
    form.append("file", new Blob([buffer], { type: mime }), name);
    const upload = await fetch(`https://graph.facebook.com/${env.whatsapp.graphVersion}/${fromNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.whatsapp.token}` },
      body: form
    });
    const uploaded = await upload.json().catch(() => ({}));
    if (!upload.ok || !uploaded.id) {
      logger.error("WhatsApp : dépôt du fichier refusé par Meta", { error: uploaded.error, contactId, mime, size: buffer.length });
      throw metaErrorToHttp(uploaded.error);
    }
    mediaId = uploaded.id;
  } catch (error) {
    if (error.status) throw error;
    logger.error("WhatsApp : Meta injoignable (dépôt du fichier)", { message: error.message });
    throw fail("Impossible de joindre WhatsApp. Réessayez dans un instant.", 502);
  }

  // 2) Le message avec ce média est envoyé au client.
  const content = format.kind === "image" ? { id: mediaId, ...(text ? { caption: text } : {}) } : { id: mediaId, filename: name, ...(text ? { caption: text } : {}) };
  const waMessageId = await postToMeta(conversation, contactId, { type: format.kind, [format.kind]: content });

  // 3) Copie conservée sur le serveur pour l'afficher dans la conversation (jamais en lien public).
  fs.mkdirSync(WA_MEDIA_DIR, { recursive: true });
  const stored = `wa_${String(contactId).slice(0, 8)}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${format.ext}`;
  fs.writeFileSync(path.join(WA_MEDIA_DIR, stored), buffer);

  const inserted = await repo.insertMessage({
    contactId,
    waMessageId,
    direction: "out",
    type: format.kind,
    body: text || (format.kind === "image" ? IMAGE_LABEL : documentLabel(name)),
    status: "sent",
    sentBy: auth.sub,
    sentAs: isAdmin(auth) && conversation.owner_id && conversation.owner_id !== auth.sub ? conversation.owner_id : null,
    mediaPath: stored,
    mediaName: name,
    mediaMime: mime
  });
  await repo.touchOutbound(contactId);
  await repo.markRead(contactId, auth.sub);
  const sentRow = (await repo.listMessages(contactId, { before: null, limit: 5 })).find((m) => m.id === inserted.id) || inserted;
  return mapMessage(sentRow, { forAdmin: isAdmin(auth) });
}

// Fichier d'un message envoyé, pour l'afficher dans l'application (même droits que la conversation).
async function getMedia(auth, contactId, messageId) {
  await getAccessibleConversation(auth, contactId);
  if (!/^[0-9a-f-]{36}$/i.test(String(messageId))) throw fail("Fichier introuvable.", 404);
  const media = await repo.findMessageMedia(contactId, messageId);
  if (!media) throw fail("Fichier introuvable.", 404);
  const absolute = path.join(WA_MEDIA_DIR, path.basename(media.media_path));
  if (!fs.existsSync(absolute)) throw fail("Le fichier n'existe plus sur le serveur.", 404);
  return { absolutePath: absolute, name: media.media_name, mime: media.media_mime };
}

// ── Réponse automatique des jours non travaillés ─────────────────────────
const DAY_NAMES = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// Dernier jour ouvré avant `parts`, puis début de la période de fermeture (minuit qui suit ce jour) et prochaine reprise.
function closurePeriod(hours, parts) {
  let lastWorkDelta = null;
  for (let delta = 1; delta <= 7; delta += 1) {
    const weekday = ((parts.isoWeekday - 1 - delta) % 7 + 7) % 7 + 1;
    if (hours.days.includes(weekday)) { lastWorkDelta = delta; break; }
  }
  const startDay = addDays(parts.year, parts.month, parts.day, -(lastWorkDelta === null ? 0 : lastWorkDelta - 1));
  const closureStart = zonedLocalToUtc(startDay.year, startDay.month, startDay.day, 0, 0, 0, hours.timezone);

  let nextDelta = null;
  for (let delta = 1; delta <= 7; delta += 1) {
    const weekday = ((parts.isoWeekday - 1 + delta) % 7) + 1;
    if (hours.days.includes(weekday)) { nextDelta = delta; break; }
  }
  const nextWeekday = nextDelta === null ? null : ((parts.isoWeekday - 1 + nextDelta) % 7) + 1;
  return { closureStart, nextWeekday };
}

function buildAutoReplyText(template, hours, nextWeekday) {
  const time = `${String(hours.start.h).padStart(2, "0")}h${String(hours.start.m).padStart(2, "0")}`;
  const reprise = nextWeekday ? `${DAY_NAMES[nextWeekday]} à ${time}` : "dès que possible";
  return String(template).replace(/\{reprise\}/g, reprise);
}

// Un jour non travaillé, le client reçoit un message pour nous réécrire à la reprise. Une seule fois par période de
// fermeture et par contact ; ce message ne compte jamais comme une réponse d'un conseiller. Ne bloque jamais la réception.
async function maybeAutoReply(contactId) {
  try {
    const config = await settings.getWhatsAppAutoReply();
    if (!config.enabled) return;
    const hours = parseWorkHours(await settings.getWorkHoursConfig());
    const parts = zonedParts(new Date(), hours.timezone);
    if (hours.days.includes(parts.isoWeekday)) return; // jour ouvré : aucune réponse automatique

    const { closureStart, nextWeekday } = closurePeriod(hours, parts);
    const last = await repo.getLastAutoReplyAt(contactId);
    if (last && new Date(last).getTime() >= closureStart.getTime()) return;

    const conversation = await repo.findConversation(contactId);
    if (!conversation || conversation.blocked_at) return;
    const body = buildAutoReplyText(config.text, hours, nextWeekday);
    const waMessageId = await postToMeta(conversation, contactId, { type: "text", text: { preview_url: false, body } });
    await repo.insertMessage({ contactId, waMessageId, direction: "out", type: "text", body, status: "sent", sentBy: null, isAuto: true });
    await repo.setLastAutoReplyAt(contactId);
    logger.info("WhatsApp : réponse automatique envoyée (jour non travaillé)", { contactId, to: maskPhone(conversation.phone) });
  } catch (error) {
    logger.warn("WhatsApp : réponse automatique impossible", { contactId, message: error.message });
  }
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
  sendMedia,
  getMedia,
  buildAutoReplyText,
  maybeAutoReply,
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
