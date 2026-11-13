const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const sanitizeHtml = require("sanitize-html");
const nodemailer = require("nodemailer");
const MailComposer = require("nodemailer/lib/mail-composer");
const { query } = require("../../db");
const { authRoles } = require("../security/rbac");
const emailService = require("./emailService");
const studentMailService = require("./studentMailService");
const userRepo = require("../repositories/userRepository");
const logger = require("../logger");
const leaveCover = require("./leaveCover");
const secretBox = require("../security/secretBox");
const staffMailboxRepo = require("../repositories/staffMailboxRepository");

// Boîtes mail dans l'application. La boîte commune de l'agence (admin) suit l'adresse et le mot de passe
// saisis dans Paramètres : c'est aussi elle qui envoie les e-mails automatiques. Chaque employé connecte
// sa propre boîte Hostinger ; l'admin peut les consulter toutes et y répondre.
// Réception par IMAP, envoi par SMTP. Rien n'est copié en base : les mails restent sur le serveur de messagerie.

const PAGE_SIZE = 25;
const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 8;
const STAFF_SMTP = { host: "smtp.hostinger.com", port: 465 };
const STAFF_IMAP = { host: "imap.hostinger.com", port: 993 };

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
  return { ...cfg, imapHost: host, imapPort: port, shared: true };
}

const NOT_CONNECTED = "Connectez votre boîte mail pour lire et envoyer vos mails.";

// Boîte ouverte : sans précision, la boîte commune pour l'admin et sa propre boîte pour un employé.
// Un employé n'ouvre jamais que la sienne ; l'admin ouvre celle de son choix.
async function resolveMailbox(auth, requested) {
  const isAdmin = authRoles(auth).includes("ADMIN");
  const wanted = String(requested || "").trim();
  if (wanted === "shared" || (!wanted && isAdmin)) {
    if (!isAdmin) throw fail("Cette boîte est réservée à l'administrateur.", 403);
    return mailboxConfig();
  }
  const ownerId = wanted || auth.sub;
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw fail("Boîte mail introuvable.", 404);
  if (ownerId !== auth.sub && !isAdmin) throw fail("Vous ne pouvez ouvrir que votre propre boîte mail.", 403);
  const row = await staffMailboxRepo.find(ownerId);
  const pass = row ? secretBox.decrypt(row.password_enc) : "";
  if (!row || !pass) {
    const error = fail(NOT_CONNECTED, 409);
    error.needsConnection = true;
    throw error;
  }
  return { user: row.email, pass, smtpHost: STAFF_SMTP.host, smtpPort: STAFF_SMTP.port, imapHost: STAFF_IMAP.host, imapPort: STAFF_IMAP.port, ownerId };
}

// L'admin qui lit la boîte d'un employé ne change pas ses mails non lus.
const readerOwnsMailbox = (auth, mailbox) => mailbox.shared || mailbox.ownerId === auth.sub;

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

async function withClient(cfg, task) {
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

// ── Étudiants : noms affichés et droits d'écriture ────────────────────────
// Adresse → étudiant inscrit avec cet e-mail : la page Mail montre son nom plutôt que l'adresse brute.
async function studentsByEmail(emails) {
  const list = [...new Set(emails.map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return new Map();
  const result = await query("SELECT id, prenom, nom, LOWER(email) AS email FROM users WHERE role = 'STUDENT' AND LOWER(email) = ANY($1::text[])", [list]);
  return new Map(result.rows.map((r) => [r.email, { id: r.id, name: `${r.prenom || ""} ${r.nom || ""}`.trim() }]));
}

async function enrichAddresses(groups) {
  const all = groups.flat().filter(Boolean);
  const map = await studentsByEmail(all.map((a) => a.address));
  for (const a of all) {
    const student = map.get(String(a.address || "").toLowerCase());
    if (student) {
      a.studentId = student.id;
      a.studentName = student.name;
    }
  }
}

// Étudiants à qui l'utilisateur peut écrire : tous pour l'admin ; le conseiller, ses étudiants assignés ;
// le Responsable Dossier, les étudiants dont une candidature lui est affectée.
function recipientsFilterSql(auth) {
  const roles = authRoles(auth);
  if (roles.includes("ADMIN")) return { where: "TRUE", params: [] };
  const clauses = [];
  // Remplaçant pendant un congé : aussi les étudiants qui lui sont confiés.
  if (roles.includes("SALES")) clauses.push("(sp.assigned_sales_id = $1 OR leave_handler(sp.assigned_sales_id, u.id, 'SALES') = $1)");
  if (roles.includes("RDV")) clauses.push("EXISTS (SELECT 1 FROM university_applications ua WHERE ua.student_id = u.id AND (ua.assigned_rdv_id = $1 OR leave_handler(ua.assigned_rdv_id, ua.student_id, 'RDV') = $1))");
  if (!clauses.length) return { where: "FALSE", params: [] };
  return { where: `(${clauses.join(" OR ")})`, params: [auth.sub] };
}

async function searchRecipients(auth, q) {
  const filter = recipientsFilterSql(auth);
  const params = [...filter.params];
  let search = "";
  const text = String(q || "").trim().toLowerCase().slice(0, 60);
  if (text) {
    params.push(`%${text}%`);
    search = `AND (LOWER(u.prenom || ' ' || u.nom) LIKE $${params.length} OR LOWER(u.nom || ' ' || u.prenom) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`;
  }
  const result = await query(
    `SELECT u.id, u.prenom, u.nom, u.email
     FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'STUDENT' AND u.email IS NOT NULL AND ${filter.where} ${search}
     ORDER BY u.prenom, u.nom LIMIT 15`,
    params
  );
  return result.rows.map((r) => ({ id: r.id, name: `${r.prenom || ""} ${r.nom || ""}`.trim(), email: r.email }));
}

async function assertCanWriteTo(auth, emails) {
  if (authRoles(auth).includes("ADMIN")) return;
  const filter = recipientsFilterSql(auth);
  const params = [...filter.params, emails.map((e) => e.toLowerCase())];
  const result = await query(
    `SELECT LOWER(u.email) AS email FROM users u LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'STUDENT' AND ${filter.where} AND LOWER(u.email) = ANY($${params.length}::text[])`,
    params
  );
  const allowed = new Set(result.rows.map((r) => r.email));
  const refused = emails.find((e) => !allowed.has(e.toLowerCase()));
  if (refused) throw fail(`Vous ne pouvez écrire qu'aux étudiants qui vous sont assignés : ${refused} n'en fait pas partie.`, 403);
}

// Remplaçant pendant un congé : un mail adressé uniquement à des étudiants d'un même conseiller absent
// part au nom de ce conseiller (continuité pour l'étudiant). L'auteur réel reste enregistré (sentBy).
async function coverSenderName(auth, emails) {
  if (!emails.length) return null;
  const result = await query(
    `SELECT u.id, sp.assigned_sales_id FROM users u JOIN student_profiles sp ON sp.user_id = u.id
     WHERE u.role = 'STUDENT' AND LOWER(u.email) = ANY($1::text[])`,
    [emails.map((e) => e.toLowerCase())]
  );
  if (result.rows.length !== new Set(emails.map((e) => e.toLowerCase())).size) return null;
  const owners = new Set(result.rows.map((row) => row.assigned_sales_id));
  if (owners.size !== 1) return null;
  const [owner] = owners;
  if (!result.rows.every((row) => leaveCover.covers(auth, owner, row.id, "SALES"))) return null;
  const user = await userRepo.findById(owner);
  return user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : null;
}

async function searchStudentEmails(text) {
  const like = `%${text.toLowerCase()}%`;
  const result = await query(
    "SELECT email FROM users WHERE role = 'STUDENT' AND email IS NOT NULL AND (LOWER(prenom || ' ' || nom) LIKE $1 OR LOWER(nom || ' ' || prenom) LIKE $1) LIMIT 5",
    [like]
  );
  return result.rows.map((r) => r.email);
}

// ── Statut (test de connexion) ─────────────────────────────────────────────
async function status(auth, requested) {
  let cfg;
  try {
    cfg = await resolveMailbox(auth, requested);
  } catch (error) {
    if (error.needsConnection) return { configured: false, ok: false, address: "", needsConnection: true, error: error.message };
    throw error;
  }
  if (!cfg.user || !cfg.pass) {
    return { configured: false, ok: false, address: cfg.user || "", error: "Boîte mail non configurée : renseignez l'adresse et le mot de passe dans Paramètres." };
  }
  try {
    return await withClient(cfg, async (client) => {
      const paths = await folderPaths(client);
      return { configured: true, ok: true, address: cfg.user, host: cfg.imapHost, hasSentFolder: Boolean(paths.sent), unread: await countUnseen(client) };
    });
  } catch (error) {
    return { configured: true, ok: false, address: cfg.user, host: cfg.imapHost, error: error.message };
  }
}

// Compteur de non lus de la barre de navigation : chaque appel ouvrait une connexion IMAP complète
// (TLS + identification), pour chaque utilisateur, chaque minute. Un résultat de moins de 30 s est
// réutilisé ; lire un message (ou en envoyer un) remet le compteur à jour tout de suite.
const UNREAD_TTL_MS = 30 * 1000;
const unreadCache = new Map();

async function unreadCount(auth, requested) {
  let cfg;
  try {
    cfg = await resolveMailbox(auth, requested);
  } catch (error) {
    if (error.needsConnection) return { unread: 0 };
    throw error;
  }
  const hit = unreadCache.get(cfg.user);
  if (hit && Date.now() - hit.at < UNREAD_TTL_MS) return hit.value;
  // Appels simultanés vers la même boîte : une seule connexion IMAP, tous reçoivent le résultat.
  if (hit?.pending) return hit.pending;
  const pending = withClient(cfg, async (client) => ({ unread: await countUnseen(client) }))
    .then((value) => {
      unreadCache.set(cfg.user, { value, at: Date.now() });
      return value;
    })
    .catch((error) => {
      unreadCache.delete(cfg.user);
      throw error;
    });
  unreadCache.set(cfg.user, { value: hit?.value, at: 0, pending });
  return pending;
}

// ── Boîte personnelle ──────────────────────────────────────────────────────
const SETTINGS_HINT = " Vérifiez-les dans Paramètres (Gmail : mot de passe d'application ; Hostinger : mot de passe de la boîte mail).";
const MAILBOX_HINT = " Vérifiez l'adresse et le mot de passe de votre boîte mail.";

// Adresse et mot de passe vérifiés sur Hostinger (réception et envoi) avant d'être enregistrés.
async function connectMailbox(auth, payload) {
  const email = String(payload?.email || "").trim().toLowerCase();
  const pass = String(payload?.password || "");
  if (!EMAIL.test(email)) throw fail("Indiquez une adresse e-mail valide.", 400);
  if (!pass) throw fail("Indiquez le mot de passe de votre boîte mail.", 400);
  const cfg = { user: email, pass, imapHost: STAFF_IMAP.host, imapPort: STAFF_IMAP.port };
  try {
    await withClient(cfg, async () => undefined);
  } catch (error) {
    throw fail(error.message.replace(SETTINGS_HINT, MAILBOX_HINT), 400);
  }
  const transporter = staffTransport(cfg);
  try {
    await transporter.verify();
  } catch (error) {
    throw fail(explainError(error, STAFF_SMTP.host).replace(SETTINGS_HINT, MAILBOX_HINT), 400);
  } finally {
    transporter.close();
  }
  await staffMailboxRepo.save(auth.sub, email, secretBox.encrypt(pass));
  logger.info("Boîte mail personnelle connectée", { by: auth.sub });
  return { email };
}

async function disconnectMailbox(auth) {
  await staffMailboxRepo.remove(auth.sub);
  return { ok: true };
}

function staffTransport(cfg) {
  return nodemailer.createTransport({ host: STAFF_SMTP.host, port: STAFF_SMTP.port, secure: true, auth: { user: cfg.user, pass: cfg.pass } });
}

// Liste des boîtes pour l'admin. Jamais de mot de passe.
async function listMailboxes() {
  const rows = await staffMailboxRepo.listAll();
  return rows.map((row) => ({ userId: row.user_id, name: `${row.prenom || ""} ${row.nom || ""}`.trim(), email: row.email }));
}

// ── Liste ──────────────────────────────────────────────────────────────────
async function listMessages(auth, { folder = "inbox", page = 1, q = "", mailbox }) {
  const cfg = await resolveMailbox(auth, mailbox);
  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const query = String(q || "").trim().slice(0, 100);
  return withClient(cfg, async (client) => {
    const path = await resolvePath(client, folder === "sent" ? "sent" : "inbox");
    if (!path) return { items: [], total: 0, page: currentPage, pageSize: PAGE_SIZE, folderMissing: true };
    const lock = await client.getMailboxLock(path, { readOnly: true });
    try {
      // La recherche trouve aussi un étudiant par son nom : ses adresses s'ajoutent aux critères.
      const byName = query.length >= 2 ? await searchStudentEmails(query) : [];
      const criteria = query
        ? { or: [{ from: query }, { to: query }, { subject: query }, { body: query }, ...byName.flatMap((email) => [{ from: email }, { to: email }])] }
        : { all: true };
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
      await enrichAddresses([items.map((i) => i.from), items.flatMap((i) => i.to)]);
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

async function getMessage(auth, { folder = "inbox", uid, mailbox }) {
  unreadCache.clear();
  const id = parseInt(uid, 10);
  if (!Number.isInteger(id) || id <= 0) throw fail("Mail introuvable.", 404);
  const cfg = await resolveMailbox(auth, mailbox);
  return withClient(cfg, async (client) => {
    const path = await resolvePath(client, folder === "sent" ? "sent" : "inbox");
    if (!path) throw fail("Dossier introuvable.", 404);
    const parsed = await fetchParsed(client, path, id, { markSeen: folder !== "sent" && readerOwnsMailbox(auth, cfg) });

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
    const fromAddress = address((parsed.from?.value || [])[0]);
    const toAddresses = addresses(parsed.to?.value);
    const ccAddresses = addresses(parsed.cc?.value);
    await enrichAddresses([[fromAddress], toAddresses, ccAddresses]);
    return {
      uid: id,
      folder: folder === "sent" ? "sent" : "inbox",
      from: fromAddress,
      to: toAddresses,
      cc: ccAddresses,
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

async function getAttachment(auth, { folder = "inbox", uid, index, mailbox }) {
  const id = parseInt(uid, 10);
  const position = parseInt(index, 10);
  if (!Number.isInteger(id) || !Number.isInteger(position) || position < 0) throw fail("Pièce jointe introuvable.", 404);
  const cfg = await resolveMailbox(auth, mailbox);
  return withClient(cfg, async (client) => {
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
  const cfg = await resolveMailbox(auth, payload.mailbox);
  // Boîte commune : le conseiller n'écrit qu'à ses étudiants, le Responsable Dossier qu'aux étudiants de ses
  // candidatures ; l'admin à tous. Dans sa propre boîte, chacun écrit librement.
  if (cfg.shared) await assertCanWriteTo(auth, [...to, ...cc]);
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

  if (!cfg.user || !cfg.pass) throw fail("Boîte mail non configurée : renseignez l'adresse et le mot de passe dans Paramètres.", 503);
  const user = await userRepo.findById(cfg.ownerId || auth.sub);
  const userName = user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "";
  let sender;
  let from;
  if (cfg.shared) {
    sender = await emailService.resolveSender();
    const staffName = (await coverSenderName(auth, [...to, ...cc])) || userName;
    from = sender.from(staffName ? ` — ${staffName}` : "");
  } else {
    sender = { transporter: staffTransport(cfg) };
    from = `"${userName.replace(/"/g, "")}" <${cfg.user}>`;
  }

  const mail = {
    from,
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

  let sentInfo = null;
  try {
    sentInfo = await sender.transporter.sendMail({ envelope: { from: cfg.user, to: [...to, ...cc] }, raw });
  } catch (error) {
    logger.error("Boîte mail : envoi refusé", { message: error.message, code: error.code });
    throw fail(`Le mail n'a pas pu être envoyé : ${String(error.response || error.message).slice(0, 160)}`, 502);
  } finally {
    sender.transporter.close?.();
  }
  logger.info("Boîte mail : mail envoyé", { by: auth.sub, mailbox: cfg.ownerId || "shared", to: to.length, attachments: attachments.length });

  // Une copie du mail est conservée dans l'espace de chaque étudiant concerné (preuve d'envoi et de réception).
  try {
    const students = await studentsByEmail([...to, ...cc]);
    for (const student of students.values()) {
      await studentMailService.record({
        studentId: student.id,
        sentBy: auth.sub,
        subject,
        body: text,
        attachments: attachments.map((a) => ({ filename: a.filename, size: a.content.length })),
        messageId: sentInfo?.messageId
      });
    }
  } catch (error) {
    logger.warn("Boîte mail : copie dans l'espace de l'étudiant impossible", { message: error.message });
  }

  // Copie dans « Envoyés » pour les serveurs qui ne la gardent pas eux-mêmes (Hostinger…). Gmail et Outlook
  // enregistrent déjà le mail envoyé : on n'ajoute rien pour ne pas le dupliquer. Sans conséquence si la copie échoue.
  const keepsSentCopy = /gmail|googlemail|office365|outlook/i.test(cfg.imapHost || "");
  try {
    if (keepsSentCopy) return { ok: true };
    await withClient(cfg, async (client) => {
      const paths = await folderPaths(client);
      if (paths.sent) await client.append(paths.sent, raw, ["\\Seen"]);
    });
  } catch (error) {
    logger.warn("Boîte mail : copie dans Envoyés impossible", { message: error.message });
  }
  return { ok: true };
}

module.exports = { status, unreadCount, listMessages, getMessage, getAttachment, send, searchRecipients, deriveImapHost, connectMailbox, disconnectMailbox, listMailboxes, resolveMailbox };
