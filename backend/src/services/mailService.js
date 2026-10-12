const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const sanitizeHtml = require("sanitize-html");
const MailComposer = require("nodemailer/lib/mail-composer");
const emailService = require("./emailService");
const userRepo = require("../repositories/userRepository");
const logger = require("../logger");

// Boîte mail commune de l'agence, dans l'application : elle suit toujours l'adresse et le mot de passe
// saisis dans Paramètres (Hostinger, Gmail…). Réception par IMAP, envoi par le même serveur SMTP que les
// e-mails automatiques. Rien n'est copié en base : les mails restent sur le serveur de messagerie.

const PAGE_SIZE = 25;
const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 8;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Serveur de réception déduit du serveur d'envoi choisi dans Paramètres (smtp.x → imap.x).
function deriveImapHost(smtpHost) {
  const host = String(smtpHost || "").trim().toLowerCase();
  if (!host) return "";
  if (/office365|outlook|hotmail|live\.com/.test(host)) return "outlook.office365.com";
  if (host.startsWith("smtp.")) return `imap.${host.slice(5)}`;
  return host;
}

async function mailboxConfig() {
  const cfg = await emailService.resolveMailboxConfig();
  const host = process.env.IMAP_HOST || deriveImapHost(cfg.smtpHost);
  const port = parseInt(process.env.IMAP_PORT, 10) || 993;
  return { ...cfg, imapHost: host, imapPort: port };
}

function explainError(error, host) {
  const detail = String(error.response || error.responseText || error.message || "");
  if (error.authenticationFailed || /auth|credential|invalid login|AUTHENTICATIONFAILED/i.test(detail)) {
    return `${host} refuse cette adresse ou ce mot de passe. Vérifiez-les dans Paramètres (Gmail : mot de passe d'application ; Hostinger : mot de passe de la boîte mail).`;
  }
  if (/ENOTFOUND|EAI_AGAIN/.test(detail) || error.code === "ENOTFOUND") return `Serveur de réception introuvable : ${host}.`;
  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|timeout/i.test(detail) || ["ETIMEDOUT", "ECONNREFUSED", "ECONNRESET"].includes(error.code)) {
    return `Impossible de joindre ${host} (délai dépassé ou connexion refusée).`;
  }
  return `Connexion à la boîte mail impossible : ${detail.slice(0, 160)}`;
}

async function withClient(task) {
  const cfg = await mailboxConfig();
  if (!cfg.user || !cfg.pass) throw fail("Boîte mail non configurée : renseignez l'adresse et le mot de passe dans Paramètres.", 503);
  if (!cfg.imapHost) throw fail("Serveur de réception inconnu : renseignez le serveur d'envoi dans Paramètres.", 503);
  const client = new ImapFlow({
    host: cfg.imapHost,
    port: cfg.imapPort,
    secure: cfg.imapPort === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 60000
  });
  client.on("error", () => undefined); // une coupure ne doit jamais faire tomber le serveur
  try {
    await client.connect();
  } catch (error) {
    logger.warn("Boîte mail : connexion IMAP refusée", { host: cfg.imapHost, message: error.message });
    throw fail(explainError(error, cfg.imapHost), 502);
  }
  try {
    return await task(client, cfg);
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

// Dossiers : la réception est toujours INBOX ; « Envoyés » se détecte (usage spécial ou nom usuel).
async function folderPaths(client) {
  const list = await client.list();
  const sent =
    list.find((f) => f.specialUse === "\\Sent") ||
    list.find((f) => /(^|[./])(sent|envoy|éléments envoy|sent items|sent messages)/i.test(f.path));
  return { inbox: "INBOX", sent: sent ? sent.path : null };
}

async function resolvePath(client, folder) {
  const paths = await folderPaths(client);
  return folder === "sent" ? paths.sent : paths.inbox;
}

const address = (entry) => (entry ? { name: entry.name || "", address: entry.address || "" } : null);
const addresses = (list) => (list || []).map(address).filter(Boolean);

function hasAttachment(node) {
  if (!node) return false;
  if (node.disposition === "attachment") return true;
  return (node.childNodes || []).some(hasAttachment);
}

function listDto(msg) {
  const envelope = msg.envelope || {};
  return {
    uid: msg.uid,
    from: address((envelope.from || [])[0]),
    to: addresses(envelope.to),
    subject: envelope.subject || "",
    date: (msg.internalDate || envelope.date || new Date()).toISOString?.() || null,
    seen: msg.flags ? msg.flags.has("\\Seen") : true,
    hasAttachments: hasAttachment(msg.bodyStructure)
  };
}

// Mails non lus de la réception (recherche plutôt que STATUS : beaucoup plus rapide sur Gmail).
async function countUnseen(client) {
  const lock = await client.getMailboxLock("INBOX", { readOnly: true });
  try {
    const found = await client.search({ seen: false }, { uid: true });
    return Array.isArray(found) ? found.length : 0;
  } finally {
    lock.release();
  }
}

// ── Statut (test de connexion) ─────────────────────────────────────────────
async function status() {
  const cfg = await mailboxConfig();
  if (!cfg.user || !cfg.pass) {
    return { configured: false, ok: false, address: cfg.user || "", error: "Boîte mail non configurée : renseignez l'adresse et le mot de passe dans Paramètres." };
  }
  try {
    return await withClient(async (client) => {
      const paths = await folderPaths(client);
      return { configured: true, ok: true, address: cfg.user, host: cfg.imapHost, hasSentFolder: Boolean(paths.sent), unread: await countUnseen(client) };
    });
  } catch (error) {
    return { configured: true, ok: false, address: cfg.user, host: cfg.imapHost, error: error.message };
  }
}

async function unreadCount() {
  return withClient(async (client) => ({ unread: await countUnseen(client) }));
}

// ── Liste ──────────────────────────────────────────────────────────────────
async function listMessages({ folder = "inbox", page = 1, q = "" }) {
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const query = String(q || "").trim().slice(0, 100);
  return withClient(async (client) => {
    const path = await resolvePath(client, folder === "sent" ? "sent" : "inbox");
    if (!path) return { items: [], total: 0, page: currentPage, pageSize: PAGE_SIZE, folderMissing: true };
    const lock = await client.getMailboxLock(path, { readOnly: true });
    try {
      const criteria = query ? { or: [{ from: query }, { to: query }, { subject: query }, { body: query }] } : { all: true };
      const found = (await client.search(criteria, { uid: true })) || [];
      const uids = [...found].sort((a, b) => b - a);
      const pageUids = uids.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
      const items = [];
      if (pageUids.length) {
        for await (const msg of client.fetch(pageUids.join(","), { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true }, { uid: true })) {
          items.push(listDto(msg));
        }
      }
      items.sort((a, b) => b.uid - a.uid);
      return { items, total: uids.length, page: currentPage, pageSize: PAGE_SIZE };
    } finally {
      lock.release();
    }
  });
}

// ── Lecture d'un mail ──────────────────────────────────────────────────────
const SAFE_STYLES = {
  "*": {
    color: [/.*/],
    "background-color": [/.*/],
    "font-size": [/.*/],
    "font-weight": [/.*/],
    "font-style": [/.*/],
    "font-family": [/.*/],
    "text-align": [/.*/],
    "text-decoration": [/.*/],
    "line-height": [/.*/],
    margin: [/.*/],
    padding: [/.*/],
    width: [/.*/],
    height: [/.*/],
    border: [/.*/]
  }
};

function cleanHtml(html) {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "span", "font", "center"]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "align", "valign", "width", "bgcolor"],
      th: ["colspan", "rowspan", "align", "valign", "width", "bgcolor"],
      table: ["width", "border", "cellpadding", "cellspacing", "align", "bgcolor"],
      font: ["color", "size", "face"],
      "*": ["style"]
    },
    allowedStyles: SAFE_STYLES,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } })
    }
  });
}

async function fetchParsed(client, path, uid, { markSeen = false } = {}) {
  const lock = await client.getMailboxLock(path, { readOnly: !markSeen });
  try {
    const msg = await client.fetchOne(String(uid), { source: true, flags: true, uid: true }, { uid: true });
    if (!msg || !msg.source) throw fail("Mail introuvable (il a peut-être été supprimé).", 404);
    const parsed = await simpleParser(msg.source);
    if (markSeen && !msg.flags.has("\\Seen")) await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    return parsed;
  } finally {
    lock.release();
  }
}

async function getMessage({ folder = "inbox", uid }) {
  const id = parseInt(uid, 10);
  if (!Number.isInteger(id) || id <= 0) throw fail("Mail introuvable.", 404);
  return withClient(async (client) => {
    const path = await resolvePath(client, folder === "sent" ? "sent" : "inbox");
    if (!path) throw fail("Dossier introuvable.", 404);
    const parsed = await fetchParsed(client, path, id, { markSeen: folder !== "sent" });

    // Images incorporées (cid:) → données directes, pour qu'elles s'affichent dans le message.
    let html = parsed.html || "";
    if (html) {
      for (const attachment of parsed.attachments || []) {
        if (attachment.cid && /^image\//i.test(attachment.contentType || "") && attachment.size < 1.5 * 1024 * 1024) {
          const dataUrl = `data:${attachment.contentType};base64,${attachment.content.toString("base64")}`;
          html = html.split(`cid:${attachment.cid}`).join(dataUrl);
        }
      }
    }
    return {
      uid: id,
      folder: folder === "sent" ? "sent" : "inbox",
      from: address((parsed.from?.value || [])[0]),
      to: addresses(parsed.to?.value),
      cc: addresses(parsed.cc?.value),
      subject: parsed.subject || "",
      date: parsed.date ? parsed.date.toISOString() : null,
      messageId: parsed.messageId || null,
      references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
      text: parsed.text || "",
      html: html ? cleanHtml(html) : "",
      attachments: (parsed.attachments || [])
        .map((a, index) => ({ index, filename: a.filename || `pièce-jointe-${index + 1}`, contentType: a.contentType || "application/octet-stream", size: a.size || 0, inline: Boolean(a.cid) && a.contentDisposition === "inline" }))
        .filter((a) => !a.inline)
    };
  });
}

async function getAttachment({ folder = "inbox", uid, index }) {
  const id = parseInt(uid, 10);
  const position = parseInt(index, 10);
  if (!Number.isInteger(id) || !Number.isInteger(position) || position < 0) throw fail("Pièce jointe introuvable.", 404);
  return withClient(async (client) => {
    const path = await resolvePath(client, folder === "sent" ? "sent" : "inbox");
    if (!path) throw fail("Dossier introuvable.", 404);
    const parsed = await fetchParsed(client, path, id);
    const attachment = (parsed.attachments || [])[position];
    if (!attachment) throw fail("Pièce jointe introuvable.", 404);
    return { filename: attachment.filename || `pièce-jointe-${position + 1}`, contentType: attachment.contentType || "application/octet-stream", content: attachment.content };
  });
}

// ── Envoi ──────────────────────────────────────────────────────────────────
const EMAIL = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

function parseRecipients(raw, label) {
  const list = (Array.isArray(raw) ? raw : String(raw || "").split(/[;,]/))
    .map((item) => String(item).trim())
    .filter(Boolean);
  for (const item of list) {
    if (!EMAIL.test(item)) throw fail(`Adresse e-mail invalide (${label}) : ${item}`, 400);
  }
  return [...new Set(list)];
}

const escapeHtml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textToHtml = (text) => `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">${escapeHtml(text).replace(/\r?\n/g, "<br>")}</div>`;

function cleanFilename(name) {
  return String(name || "fichier").replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 120) || "fichier";
}

async function send(auth, payload) {
  const to = parseRecipients(payload.to, "destinataire");
  const cc = parseRecipients(payload.cc, "copie");
  if (!to.length) throw fail("Indiquez au moins un destinataire.", 400);
  if (to.length + cc.length > 20) throw fail("Trop de destinataires (20 maximum).", 400);
  const subject = String(payload.subject || "").trim().slice(0, 300);
  if (!subject) throw fail("Indiquez l'objet du mail.", 400);
  const text = String(payload.text || "");
  if (!text.trim()) throw fail("Le message est vide.", 400);
  if (text.length > 100000) throw fail("Le message est trop long.", 400);

  const attachments = [];
  let totalBytes = 0;
  const incoming = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (incoming.length > MAX_ATTACHMENT_COUNT) throw fail(`Trop de pièces jointes (${MAX_ATTACHMENT_COUNT} maximum).`, 400);
  for (const item of incoming) {
    const base64 = String(item?.content || "").replace(/^data:[^;]*;base64,/, "");
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) throw fail(`La pièce jointe « ${cleanFilename(item?.filename)} » est vide.`, 400);
    totalBytes += buffer.length;
    if (totalBytes > MAX_ATTACHMENTS_BYTES) throw fail("Les pièces jointes dépassent 10 Mo au total.", 400);
    attachments.push({ filename: cleanFilename(item.filename), content: buffer, contentType: String(item.contentType || "application/octet-stream").slice(0, 100) });
  }

  const [sender, cfg, user] = await Promise.all([emailService.resolveSender(), mailboxConfig(), userRepo.findById(auth.sub)]);
  if (!cfg.user || !cfg.pass) throw fail("Boîte mail non configurée : renseignez l'adresse et le mot de passe dans Paramètres.", 503);
  const staffName = user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "";

  const mail = {
    from: sender.from(staffName ? ` — ${staffName}` : ""),
    to,
    cc: cc.length ? cc : undefined,
    subject,
    text,
    html: textToHtml(text),
    replyTo: cfg.user,
    attachments,
    inReplyTo: payload.inReplyTo ? String(payload.inReplyTo).slice(0, 300) : undefined,
    references: Array.isArray(payload.references) ? payload.references.map((r) => String(r).slice(0, 300)).slice(-20) : undefined
  };
  const raw = await new MailComposer(mail).compile().build();

  try {
    await sender.transporter.sendMail({ envelope: { from: cfg.user, to: [...to, ...cc] }, raw });
  } catch (error) {
    logger.error("Boîte mail : envoi refusé", { message: error.message, code: error.code });
    throw fail(`Le mail n'a pas pu être envoyé : ${String(error.response || error.message).slice(0, 160)}`, 502);
  } finally {
    sender.transporter.close?.();
  }
  logger.info("Boîte mail : mail envoyé", { by: auth.sub, to: to.length, attachments: attachments.length });

  // Copie dans « Envoyés » pour les serveurs qui ne la gardent pas eux-mêmes (Hostinger…). Gmail et Outlook
  // enregistrent déjà le mail envoyé : on n'ajoute rien pour ne pas le dupliquer. Sans conséquence si la copie échoue.
  const keepsSentCopy = /gmail|googlemail|office365|outlook/i.test(cfg.imapHost || "");
  try {
    if (keepsSentCopy) return { ok: true };
    await withClient(async (client) => {
      const paths = await folderPaths(client);
      if (paths.sent) await client.append(paths.sent, raw, ["\\Seen"]);
    });
  } catch (error) {
    logger.warn("Boîte mail : copie dans Envoyés impossible", { message: error.message });
  }
  return { ok: true };
}

module.exports = { status, unreadCount, listMessages, getMessage, getAttachment, send, deriveImapHost };
