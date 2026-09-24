const students = require("../repositories/studentRepository");
const settings = require("../repositories/settingsRepository");
const emailService = require("../services/emailService");
const logger = require("../logger");

const FREQUENCY_MS = {
  once: null, // jamais renvoyé une fois parti
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
};

function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function shouldSend(row, frequency) {
  if (!row.stalled_alert_last_sent_at) return true;
  const interval = FREQUENCY_MS[frequency];
  if (interval === null || interval === undefined) return false; // "once" déjà envoyé
  return Date.now() - new Date(row.stalled_alert_last_sent_at).getTime() >= interval;
}

// Vérifie tous les étudiants bloqués sur "Sans candidature" depuis plus que
// le seuil configuré, et prévient l'admin + le conseiller assigné par email.
// Le seuil, la fréquence de rappel et l'adresse admin sont réglables par
// l'admin depuis Paramètres (settingsRepository), jamais codés en dur.
async function runCheck() {
  const config = await settings.getStalledAlertConfig();
  const rows = await students.findStalledNoApplication();

  for (const row of rows) {
    const daysStalled = daysSince(row.onboarding_completed_at);
    if (daysStalled < config.days) continue;
    if (!shouldSend(row, config.frequency)) continue;

    const recipients = new Set();
    if (config.email) recipients.add(config.email);
    if (row.sales_email) recipients.add(row.sales_email);
    if (!recipients.size) continue;

    const studentName = `${row.prenom} ${row.nom}`.trim();
    const salesLabel = row.sales_prenom ? `${row.sales_prenom} ${row.sales_nom}` : "aucun conseiller assigné";
    const message =
      `L'étudiant ${studentName} (${row.email}) est bloqué sur l'étape "Sans candidature" depuis ${daysStalled} jour${daysStalled > 1 ? "s" : ""}.\n` +
      `Conseiller assigné : ${salesLabel}.\n` +
      `Une candidature universitaire doit être créée pour ce dossier.`;

    try {
      await Promise.all(
        [...recipients].map((to) => emailService.sendAlertEmail(to, `Dossier bloqué — ${studentName}`, message))
      );
      await students.markStalledAlertSent(row.id);
    } catch (error) {
      logger.error("Échec envoi alerte dossier bloqué", { studentId: row.id, message: error.message });
    }
  }
}

module.exports = { runCheck };
