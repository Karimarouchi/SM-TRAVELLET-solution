// Sauvegarde à sens unique prod → Supabase, réutilisée à la fois par le
// script planifié (backend/scripts/backup-to-supabase.js) et par le bouton
// "Lancer maintenant" de l'admin. Ne restaure jamais rien automatiquement
// dans la prod (voir backend/scripts/README.md).
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const env = require("../config/env");
const logger = require("../logger");

const STATUS_FILE = path.join(__dirname, "../../logs/last-backup.json");
const RESTORE_STATUS_FILE = path.join(__dirname, "../../logs/last-restore.json");

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1024 * 1024 * 200 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// pg_restore refuse de continuer si la moindre commande échoue (code de
// sortie non nul), même quand l'unique erreur est un simple réglage de
// session propre à une version plus récente de Postgres que le serveur
// cible ne reconnaît pas (ex. "transaction_timeout", ajouté en v17) — ça
// n'affecte aucune donnée réelle, juste ce réglage ignoré. On tolère
// explicitement ce cas précis plutôt que de faire échouer toute la
// sauvegarde/restauration pour une ligne cosmétique.
function isOnlyIgnorableSessionSettingError(stderr) {
  if (!stderr) return false;
  const meaningfulLines = stderr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/warning: errors ignored on restore/i.test(line))
    .filter((line) => !/unrecognized configuration parameter/i.test(line))
    .filter((line) => !/^command was: set (transaction_timeout|idle_session_timeout)/i.test(line));
  return meaningfulLines.length === 0;
}

// Chemin configuré (PG_DUMP_PATH...) seulement s'il existe vraiment : un
// chemin Windows recopié par erreur dans le .env du serveur Linux ne doit
// pas casser la sauvegarde — on retombe alors sur l'outil du système.
function binary(configuredPath, fallback) {
  if (configuredPath && fs.existsSync(configuredPath)) return configuredPath;
  if (configuredPath) logger.warn(`Outil introuvable : ${configuredPath} — utilisation de ${fallback}.`);
  return fallback;
}

// psql est installé avec pg_dump (même dossier en local Windows, dans le
// PATH de l'image Docker).
function psqlBinary(pgDump) {
  if (!path.isAbsolute(pgDump)) return "psql";
  return path.join(path.dirname(pgDump), path.extname(pgDump) === ".exe" ? "psql.exe" : "psql");
}

function writeStatus(file, status) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(status, null, 2));
}

function readStatus(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function getStatus() {
  return readStatus(STATUS_FILE);
}

function getRestoreStatus() {
  return readStatus(RESTORE_STATUS_FILE);
}

async function runBackup(triggeredBy) {
  if (!env.backup.supabaseDatabaseUrl) {
    throw fail("SUPABASE_DATABASE_URL n'est pas configuré sur ce serveur.", 409);
  }

  const dumpFile = path.join(os.tmpdir(), `sm-travel-backup-${Date.now()}.dump`);
  // En production (image Docker), "pg_dump"/"pg_restore" suffisent — déjà
  // dans le PATH. En local (notamment Windows), ils ne le sont pas toujours :
  // PG_DUMP_PATH / PG_RESTORE_PATH permettent de pointer vers le binaire
  // exact sans avoir à modifier le PATH système.
  const pgDump = binary(env.backup.pgDumpPath, "pg_dump");
  const pgRestore = binary(env.backup.pgRestorePath, "pg_restore");

  try {
    await run(pgDump, ["--format=custom", "--schema=public", `--file=${dumpFile}`, env.databaseUrl]);

    // La copie Supabase est entièrement vidée puis réécrite : elle reste le
    // reflet exact de la prod, même quand une table a été supprimée en prod
    // (sinon l'ancienne table, restée côté Supabase, bloque toute la copie).
    // Fait seulement APRÈS un export réussi, pour ne jamais vider la copie
    // si la prod n'a pas pu être lue.
    await run(psqlBinary(pgDump), [
      env.backup.supabaseDatabaseUrl,
      "-v", "ON_ERROR_STOP=1",
      "-c", "DROP SCHEMA IF EXISTS public CASCADE;"
    ]);

    try {
      await run(pgRestore, [
        "--no-owner",
        "--no-privileges",
        `--dbname=${env.backup.supabaseDatabaseUrl}`,
        dumpFile
      ]);
    } catch (restoreError) {
      if (!isOnlyIgnorableSessionSettingError(restoreError.stderr)) throw restoreError;
      logger.info("Sauvegarde vers Supabase : réglage de session ignoré sans impact.", { stderr: restoreError.stderr });
    }

    const status = { success: true, at: new Date().toISOString(), triggeredBy: triggeredBy || "cron" };
    writeStatus(STATUS_FILE, status);
    logger.info("Sauvegarde vers Supabase réussie.", { triggeredBy: status.triggeredBy });
    return status;
  } catch (error) {
    const message = error.stderr || error.message;
    const status = { success: false, at: new Date().toISOString(), error: message, triggeredBy: triggeredBy || "cron" };
    writeStatus(STATUS_FILE, status);
    logger.error("Échec de la sauvegarde vers Supabase", { message, triggeredBy: status.triggeredBy });
    throw fail(`Échec de la sauvegarde : ${message}`, 500);
  } finally {
    fs.rm(dumpFile, { force: true }, () => {});
  }
}

// Restauration MANUELLE, en sens inverse : Supabase → prod. Réservée aux cas
// de sinistre (perte de données en prod) — jamais déclenchée automatiquement,
// uniquement par un admin qui clique explicitement sur "Restaurer" (avec
// confirmation côté UI, puisque ça écrase la base de production actuelle).
async function runRestore(triggeredBy) {
  if (!env.backup.supabaseDatabaseUrl) {
    throw fail("SUPABASE_DATABASE_URL n'est pas configuré sur ce serveur.", 409);
  }

  const dumpFile = path.join(os.tmpdir(), `sm-travel-restore-${Date.now()}.dump`);
  const pgDump = binary(env.backup.pgDumpPath, "pg_dump");
  const pgRestore = binary(env.backup.pgRestorePath, "pg_restore");

  try {
    await run(pgDump, ["--format=custom", "--schema=public", `--file=${dumpFile}`, env.backup.supabaseDatabaseUrl]);
    try {
      await run(pgRestore, [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        `--dbname=${env.databaseUrl}`,
        dumpFile
      ]);
    } catch (restoreError) {
      if (!isOnlyIgnorableSessionSettingError(restoreError.stderr)) throw restoreError;
      logger.info("Restauration depuis Supabase : réglage de session ignoré sans impact.", { stderr: restoreError.stderr });
    }

    const status = { success: true, at: new Date().toISOString(), triggeredBy: triggeredBy || "admin" };
    writeStatus(RESTORE_STATUS_FILE, status);
    logger.info("Restauration depuis Supabase réussie.", { triggeredBy: status.triggeredBy });
    return status;
  } catch (error) {
    const message = error.stderr || error.message;
    const status = { success: false, at: new Date().toISOString(), error: message, triggeredBy: triggeredBy || "admin" };
    writeStatus(RESTORE_STATUS_FILE, status);
    logger.error("Échec de la restauration depuis Supabase", { message, triggeredBy: status.triggeredBy });
    throw fail(`Échec de la restauration : ${message}`, 500);
  } finally {
    fs.rm(dumpFile, { force: true }, () => {});
  }
}

// ── Sauvegarde automatique (planifiée par le backend lui-même) ──────────
// Plus besoin de crontab sur le serveur : app.js appelle cette vérification
// toutes les 30 min. Uniquement en production — sinon une base locale de
// test écraserait la vraie sauvegarde Supabase.
const BACKUP_EVERY_MS = 12 * 60 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000;
const ALERT_EVERY_MS = 12 * 60 * 60 * 1000;
let lastAlertAt = 0;

async function alertBackupFailure(message) {
  if (Date.now() - lastAlertAt < ALERT_EVERY_MS) return;
  lastAlertAt = Date.now();
  // Chargés ici pour éviter une dépendance circulaire au démarrage.
  const notificationService = require("./notificationService");
  const emailService = require("./emailService");
  await notificationService.notifyAdmins({
    type: "BACKUP_FAILED",
    title: "La sauvegarde automatique a échoué",
    body: String(message).slice(0, 300),
    link: "/admin/settings"
  });
  if (env.backup.alertEmail) {
    await emailService
      .sendAlertEmail(env.backup.alertEmail, "La sauvegarde Supabase a échoué", String(message))
      .catch((error) => logger.error("Échec de l'email d'alerte de sauvegarde", { message: error.message }));
  }
}

async function runScheduledBackup() {
  if (process.env.NODE_ENV !== "production" || !env.backup.supabaseDatabaseUrl) return;

  const status = getStatus();
  const age = status?.at ? Date.now() - new Date(status.at).getTime() : Infinity;
  const due = status?.success === false ? age >= RETRY_AFTER_FAILURE_MS : age >= BACKUP_EVERY_MS;
  if (!due) return;

  try {
    await runBackup("auto");
    lastAlertAt = 0;
  } catch (error) {
    await alertBackupFailure(error.message);
  }
}

module.exports = { runBackup, getStatus, runRestore, getRestoreStatus, runScheduledBackup };
