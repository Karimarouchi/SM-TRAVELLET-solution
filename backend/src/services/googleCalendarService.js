const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("../logger");
const settings = require("../repositories/settingsRepository");

// Liens Meet créés automatiquement via Google Calendar.
//
// Principe : l'admin connecte UNE FOIS un compte Google depuis Paramètres
// (consentement OAuth). On garde seulement le jeton de rafraîchissement,
// chiffré en base. Chaque lien Meet est ensuite un événement créé dans
// l'agenda de ce compte, avec une visioconférence Google Meet et l'étudiant
// (et la personne qui planifie) en invités.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Droits demandés : créer/modifier des événements (pas de lecture de
// l'agenda complet) + l'adresse du compte, pour l'afficher dans Paramètres.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"];
const STATE_PURPOSE = "google-oauth";
const TIME_ZONE = "Africa/Tunis";

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isConfigured() {
  return Boolean(env.google.clientId && env.google.clientSecret);
}

function redirectUri() {
  return env.google.redirectUri || `${env.appPublicUrl}/api/google/callback`;
}

function assertConfigured() {
  if (!isConfigured()) {
    throw fail("Google Calendar n'est pas configuré sur ce serveur (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).", 503);
  }
}

// ── Chiffrement du jeton au repos (AES-256-GCM) ────────────────────────────
// La clé dérive de JWT_SECRET : un export de la base seul ne donne pas accès
// à l'agenda. Si JWT_SECRET change, il suffit de reconnecter Google.
function encryptionKey() {
  return crypto.createHash("sha256").update(`google-token:${env.jwtSecret}`).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(payload) {
  const [iv, tag, data] = String(payload).split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function googleFetch(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    logger.error("Google : service injoignable", { url, message: error.message });
    throw fail("Impossible de joindre Google. Réessayez dans un instant.", 502);
  }
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

// ── Connexion (OAuth) ──────────────────────────────────────────────────────
function buildAuthUrl(adminId) {
  assertConfigured();
  // « state » signé : relie le retour de Google à l'admin qui a lancé la
  // connexion et empêche de forger un faux retour (CSRF).
  const state = jwt.sign({ purpose: STATE_PURPOSE, sub: adminId }, env.jwtSecret, { expiresIn: "10m" });
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Force le consentement : sans lui, Google ne renvoie le jeton de
    // rafraîchissement qu'à la toute première connexion.
    prompt: "consent",
    state
  });
  return `${AUTH_URL}?${params}`;
}

async function handleCallback(code, state) {
  assertConfigured();
  try {
    const payload = jwt.verify(String(state || ""), env.jwtSecret);
    if (payload.purpose !== STATE_PURPOSE) throw new Error("mauvais objet");
  } catch {
    throw fail("Lien de connexion expiré ou invalide. Relancez la connexion depuis Paramètres.", 400);
  }
  if (!code) throw fail("Google n'a renvoyé aucun code de connexion.", 400);

  const { response, data } = await googleFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code),
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code"
    })
  });
  if (!response.ok) {
    logger.error("Google : échange du code refusé", { error: data.error, description: data.error_description });
    if (data.error === "redirect_uri_mismatch") {
      throw fail(`Google refuse l'adresse de retour. Ajoutez exactement ${redirectUri()} dans « URI de redirection autorisés » du client OAuth.`, 400);
    }
    throw fail(`Google a refusé la connexion (${data.error_description || data.error || response.status}).`, 400);
  }
  if (!data.refresh_token) {
    throw fail("Google n'a pas fourni d'autorisation durable. Retirez l'accès de l'application dans votre compte Google puis reconnectez.", 400);
  }
  if (!String(data.scope || "").includes("calendar.events")) {
    throw fail("L'accès à l'agenda n'a pas été accordé : cochez-le sur l'écran Google puis reconnectez.", 400);
  }

  const info = await googleFetch(USERINFO_URL, { headers: { Authorization: `Bearer ${data.access_token}` } });
  await settings.setGoogleConnection({ refreshToken: encrypt(data.refresh_token), email: info.data.email || "" });
  cached = null;
  return { email: info.data.email || "" };
}

// ── Jeton d'accès (valable ~1 h, renouvelé à la demande) ───────────────────
let cached = null;

async function getAccessToken() {
  assertConfigured();
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const connection = await settings.getGoogleConnection();
  if (!connection.refreshToken) {
    throw fail("Google Calendar n'est pas connecté. L'administrateur doit le connecter dans Paramètres.", 409);
  }
  let refreshToken;
  try {
    refreshToken = decrypt(connection.refreshToken);
  } catch {
    await settings.clearGoogleConnection();
    throw fail("La connexion Google doit être refaite (Paramètres).", 409);
  }

  const { response, data } = await googleFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      grant_type: "refresh_token"
    })
  });
  if (!response.ok) {
    logger.error("Google : renouvellement du jeton refusé", { error: data.error, description: data.error_description });
    if (data.error === "invalid_grant") {
      // Accès retiré côté Google, ou jeton expiré (application encore en
      // mode « Test » : 7 jours). Inutile de réessayer : il faut reconnecter.
      await settings.clearGoogleConnection();
      cached = null;
      throw fail("L'accès à Google a expiré ou a été retiré. L'administrateur doit reconnecter Google dans Paramètres.", 409);
    }
    throw fail("Google a refusé de renouveler l'accès. Réessayez dans un instant.", 502);
  }
  cached = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cached.token;
}

async function getStatus() {
  const connection = await settings.getGoogleConnection();
  return {
    configured: isConfigured(),
    connected: Boolean(connection.refreshToken),
    email: connection.email,
    connectedAt: connection.connectedAt || null,
    redirectUri: redirectUri()
  };
}

async function disconnect() {
  const connection = await settings.getGoogleConnection();
  if (connection.refreshToken) {
    try {
      // Retire l'autorisation côté Google aussi (pas seulement chez nous).
      await googleFetch(`${REVOKE_URL}?token=${encodeURIComponent(decrypt(connection.refreshToken))}`, { method: "POST" });
    } catch (error) {
      logger.warn("Google : révocation impossible (ignorée)", { message: error.message });
    }
  }
  await settings.clearGoogleConnection();
  cached = null;
}

// ── Création du lien Meet ──────────────────────────────────────────────────
// attendees : adresses des invités (étudiant, personne qui planifie). Google
// leur envoie l'invitation et l'événement apparaît dans leur agenda.
async function createMeetEvent({ title, description, startAt, durationMinutes = 60, attendees = [] }) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) throw fail("Date/heure invalide.", 400);
  const minutes = Math.min(Math.max(parseInt(durationMinutes, 10) || 60, 15), 480);
  const end = new Date(start.getTime() + minutes * 60_000);

  const token = await getAccessToken();
  const unique = [...new Set(attendees.map((a) => String(a || "").trim().toLowerCase()).filter((a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a)))];
  const { response, data } = await googleFetch(`${EVENTS_URL}?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title,
      description: description || undefined,
      start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
      attendees: unique.map((email) => ({ email })),
      conferenceData: {
        createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } }
      },
      reminders: { useDefault: true }
    })
  });

  if (!response.ok) {
    logger.error("Google : création de l'événement refusée", { status: response.status, error: data.error });
    if (response.status === 401 || response.status === 403) {
      cached = null;
      throw fail("Google a refusé de créer l'événement : l'accès à l'agenda est insuffisant. L'administrateur doit reconnecter Google dans Paramètres.", 409);
    }
    throw fail("Google n'a pas pu créer le lien Meet. Réessayez ou collez un lien à la main.", 502);
  }

  let event = data;
  // La visioconférence peut être « en cours de création » : on relit
  // l'événement quelques fois avant d'abandonner.
  for (let attempt = 0; attempt < 4 && !event.hangoutLink; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const reread = await googleFetch(`${EVENTS_URL}/${encodeURIComponent(event.id)}?conferenceDataVersion=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (reread.response.ok) event = reread.data;
  }
  if (!event.hangoutLink) throw fail("Google n'a pas fourni de lien Meet. Réessayez ou collez un lien à la main.", 502);
  return { link: event.hangoutLink, eventId: event.id, htmlLink: event.htmlLink || null };
}

module.exports = {
  isConfigured,
  redirectUri,
  buildAuthUrl,
  handleCallback,
  getStatus,
  disconnect,
  createMeetEvent,
  // exportés pour les tests
  encrypt,
  decrypt
};
