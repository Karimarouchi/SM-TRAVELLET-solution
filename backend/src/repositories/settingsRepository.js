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
  const [fromName, fromAddress, appPassword, smtpHost, smtpPort] = await Promise.all([
    get("email_from_name"),
    get("email_from_address"),
    get("email_smtp_app_password"),
    get("email_smtp_host"),
    get("email_smtp_port")
  ]);
  return {
    fromName: fromName || "",
    fromAddress: fromAddress || "",
    hasAppPassword: Boolean(appPassword),
    smtpHost: smtpHost || "",
    smtpPort: parseInt(smtpPort, 10) || null
  };
}

// Version interne, avec le mot de passe en clair — réservée à l'envoi réel
// des emails (emailService), jamais renvoyée par une route API.
async function getEmailSenderSecrets() {
  const [fromName, fromAddress, appPassword, smtpHost, smtpPort] = await Promise.all([
    get("email_from_name"),
    get("email_from_address"),
    get("email_smtp_app_password"),
    get("email_smtp_host"),
    get("email_smtp_port")
  ]);
  return {
    fromName: fromName || "",
    fromAddress: fromAddress || "",
    appPassword: appPassword || "",
    smtpHost: smtpHost || "",
    smtpPort: parseInt(smtpPort, 10) || null
  };
}

async function setEmailSenderConfig({ fromName, fromAddress, appPassword, smtpHost, smtpPort }) {
  await set("email_from_name", fromName || "");
  await set("email_from_address", fromAddress || "");
  // Un mot de passe vide/absent dans la requête ne doit PAS effacer celui
  // déjà enregistré : dans le formulaire, un champ vide signifie "inchangé",
  // pas "supprimer". Il faut un mot de passe non vide pour le remplacer.
  if (appPassword) {
    await set("email_smtp_app_password", appPassword);
  }
  // Serveur d'envoi (smtp.gmail.com, smtp.hostinger.com...) : doit
  // correspondre à l'adresse, sinon le serveur refuse la connexion.
  if (smtpHost !== undefined) await set("email_smtp_host", smtpHost || "");
  if (smtpPort !== undefined) await set("email_smtp_port", smtpPort ? String(smtpPort) : "");
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

const WEEKDAY_IDS = [1, 2, 3, 4, 5, 6, 7];

async function getWorkHoursConfig() {
  const [days, start, end, timezone, halfway] = await Promise.all([
    get("work_days"),
    get("work_start"),
    get("work_end"),
    get("work_timezone"),
    get("work_halfway_minutes")
  ]);
  return {
    days: days || "1,2,3,4,5",
    start: start || "09:00",
    end: end || "18:00",
    timezone: timezone || "Africa/Tunis",
    halfwayMinutes: halfway || "960"
  };
}

async function setWorkHoursConfig({ days, start, end, timezone, halfwayMinutes }) {
  if (days !== undefined) await set("work_days", Array.isArray(days) ? days.join(",") : String(days));
  if (start !== undefined) await set("work_start", String(start));
  if (end !== undefined) await set("work_end", String(end));
  if (timezone !== undefined) await set("work_timezone", String(timezone));
  if (halfwayMinutes !== undefined) await set("work_halfway_minutes", String(halfwayMinutes));
  return getWorkHoursConfig();
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
  getWorkHoursConfig,
  setWorkHoursConfig,
  STALLED_ALERT_FREQUENCIES,
  WEEKDAY_IDS
};
