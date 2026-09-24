const { query } = require("../../db");

async function get(key) {
  const result = await query("SELECT value FROM app_settings WHERE key = $1", [key]);
  return result.rows[0]?.value ?? null;
}

async function set(key, value) {
  await query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
  return String(value);
}

async function isAutoAssignEnabled() {
  const value = await get("auto_assign_sales");
  return value !== "false";
}

// Version exposable à l'admin (via l'API) : jamais le mot de passe en clair,
// juste un indicateur qu'il est renseigné.
async function getEmailSenderConfig() {
  const [fromName, fromAddress, appPassword] = await Promise.all([
    get("email_from_name"),
    get("email_from_address"),
    get("email_smtp_app_password")
  ]);
  return { fromName: fromName || "", fromAddress: fromAddress || "", hasAppPassword: Boolean(appPassword) };
}

// Version interne, avec le mot de passe en clair — réservée à l'envoi réel
// des emails (emailService), jamais renvoyée par une route API.
async function getEmailSenderSecrets() {
  const [fromName, fromAddress, appPassword] = await Promise.all([
    get("email_from_name"),
    get("email_from_address"),
    get("email_smtp_app_password")
  ]);
  return { fromName: fromName || "", fromAddress: fromAddress || "", appPassword: appPassword || "" };
}

async function setEmailSenderConfig({ fromName, fromAddress, appPassword }) {
  await set("email_from_name", fromName || "");
  await set("email_from_address", fromAddress || "");
  // Un mot de passe vide/absent dans la requête ne doit PAS effacer celui
  // déjà enregistré : dans le formulaire, un champ vide signifie "inchangé",
  // pas "supprimer". Il faut un mot de passe non vide pour le remplacer.
  if (appPassword) {
    await set("email_smtp_app_password", appPassword);
  }
}

const STALLED_ALERT_FREQUENCIES = ["once", "daily", "weekly"];

async function getStalledAlertConfig() {
  const [days, frequency, email] = await Promise.all([
    get("stalled_alert_days"),
    get("stalled_alert_frequency"),
    get("stalled_alert_email")
  ]);
  return {
    days: days ? parseInt(days, 10) : 30,
    frequency: STALLED_ALERT_FREQUENCIES.includes(frequency) ? frequency : "once",
    email: email || ""
  };
}

async function setStalledAlertConfig({ days, frequency, email }) {
  await set("stalled_alert_days", days);
  await set("stalled_alert_frequency", frequency);
  await set("stalled_alert_email", email || "");
}

async function getArchivePurgeConfig() {
  const enabled = await get("archive_auto_purge_enabled");
  const days = await get("archive_purge_days");
  return {
    enabled: enabled === "true",
    days: days ? parseInt(days, 10) : 30
  };
}

async function setArchivePurgeConfig(enabled, days) {
  await set("archive_auto_purge_enabled", enabled ? "true" : "false");
  await set("archive_purge_days", days.toString());
}

module.exports = {
  get,
  set,
  isAutoAssignEnabled,
  getArchivePurgeConfig,
  setArchivePurgeConfig,
  getStalledAlertConfig,
  setStalledAlertConfig,
  getEmailSenderConfig,
  getEmailSenderSecrets,
  setEmailSenderConfig,
  STALLED_ALERT_FREQUENCIES
};
