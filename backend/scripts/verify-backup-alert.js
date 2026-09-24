// Vérifie que la dernière sauvegarde (backup-to-supabase.js) s'est bien
// déroulée et n'est pas trop ancienne. N'écrit JAMAIS dans la base — se
// contente d'envoyer une alerte email si quelque chose ne va pas.
//
// Usage : node backend/scripts/verify-backup-alert.js
// Prévu pour être lancé par une tâche planifiée tous les jours à 00h.

const fs = require("fs");
const path = require("path");
const env = require("../src/config/env");
const logger = require("../src/logger");
const emailService = require("../src/services/emailService");

const STATUS_FILE = path.join(__dirname, "../logs/last-backup.json");
const MAX_AGE_HOURS = 13; // un peu plus que les 12h entre deux sauvegardes

async function alert(subject, message) {
  logger.error(`[backup-check] ${subject}`, { message });
  console.error(subject, "-", message);
  if (!env.backup.alertEmail) {
    console.error("BACKUP_ALERT_EMAIL n'est pas défini — alerte journalisée uniquement, aucun email envoyé.");
    return;
  }
  await emailService.sendAlertEmail(env.backup.alertEmail, subject, message);
}

async function main() {
  if (!fs.existsSync(STATUS_FILE)) {
    await alert(
      "Aucune sauvegarde Supabase trouvée",
      "Le fichier de statut de sauvegarde n'existe pas encore. Vérifiez que la tâche planifiée de sauvegarde (backup-to-supabase.js) est bien active."
    );
    process.exitCode = 1;
    return;
  }

  const status = JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
  const ageHours = (Date.now() - new Date(status.at).getTime()) / 3600000;

  if (!status.success) {
    await alert(
      "La dernière sauvegarde Supabase a échoué",
      `Dernière tentative : ${status.at}\nErreur : ${status.error || "inconnue"}`
    );
    process.exitCode = 1;
    return;
  }

  if (ageHours > MAX_AGE_HOURS) {
    await alert(
      "La sauvegarde Supabase est en retard",
      `Dernière sauvegarde réussie il y a ${ageHours.toFixed(1)} heures (le ${status.at}). Elle devrait avoir lieu toutes les 12h — vérifiez que la tâche planifiée tourne toujours.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`OK — dernière sauvegarde réussie il y a ${ageHours.toFixed(1)} heures.`);
}

main();
