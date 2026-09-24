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

function writeStatus(status) {
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function getStatus() {
  if (!fs.existsSync(STATUS_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATUS_FILE, "utf8"));
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
    writeStatus(status);
    logger.info("Sauvegarde vers Supabase réussie.", { triggeredBy: status.triggeredBy });
    return status;
  } catch (error) {
    const message = error.stderr || error.message;
    const status = { success: false, at: new Date().toISOString(), error: message, triggeredBy: triggeredBy || "cron" };
    writeStatus(status);
    logger.error("Échec de la sauvegarde vers Supabase", { message, triggeredBy: status.triggeredBy });
    throw fail(`Échec de la sauvegarde : ${message}`, 500);
  } finally {
    fs.rm(dumpFile, { force: true }, () => {});
  }
}

module.exports = { runBackup, getStatus };
