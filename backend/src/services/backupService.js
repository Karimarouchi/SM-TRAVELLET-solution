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
  const pgDump = env.backup.pgDumpPath || "pg_dump";
  const pgRestore = env.backup.pgRestorePath || "pg_restore";

  try {
    await run(pgDump, ["--format=custom", `--file=${dumpFile}`, env.databaseUrl]);
    await run(pgRestore, [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      `--dbname=${env.backup.supabaseDatabaseUrl}`,
      dumpFile
    ]);

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
  const pgDump = env.backup.pgDumpPath || "pg_dump";
  const pgRestore = env.backup.pgRestorePath || "pg_restore";

  try {
    await run(pgDump, ["--format=custom", `--file=${dumpFile}`, env.backup.supabaseDatabaseUrl]);
    await run(pgRestore, [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      `--dbname=${env.databaseUrl}`,
      dumpFile
    ]);

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

module.exports = { runBackup, getStatus, runRestore, getRestoreStatus };
