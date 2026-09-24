const env = require("./src/config/env");
const { migrate } = require("./src/db/migrate");
const { seed } = require("./src/db/seed");
const { bootstrapAdmin } = require("./src/db/bootstrapAdmin");
const { ensureDatabase } = require("./db");
const app = require("./src/app");
const logger = require("./src/logger");

// Une promesse rejetée non attrapée ou une exception non catchée ne doivent
// jamais planter le process silencieusement sans laisser de trace exploitable.
process.on("unhandledRejection", (reason) => {
  logger.error("Promesse rejetée non gérée", { reason: reason instanceof Error ? reason.stack : reason });
});
process.on("uncaughtException", (error) => {
  logger.error("Exception non interceptée — arrêt du process", { message: error.message, stack: error.stack });
  process.exit(1);
});

// Le seed crée des comptes de démo à mots de passe fixes et publics (y
// compris un compte ADMIN) — indispensable en dev, mais ne doit JAMAIS
// tourner en production : n'importe qui lisant ce code source connaîtrait
// alors un accès admin complet sur la base réelle.
const isProduction = process.env.NODE_ENV === "production";

async function start() {
  await ensureDatabase();
  await migrate();
  if (!isProduction) {
    await seed();
  }
  await bootstrapAdmin();

  app.listen(env.port, () => {
    console.log(`SM Travel backend prêt sur http://localhost:${env.port}`);
    console.log("PostgreSQL : sm_travel · JWT · Phase 1");
    if (!isProduction) {
      console.log("STUDENT : demo@smtravel.fr / Demo2024!");
      console.log("SALES   : sales@smtravel.fr / Sales2024!");
      console.log("ADMIN   : admin@smtravel.fr / Admin2024!");
    }
  });
}

start().catch((error) => {
  logger.error("Impossible de démarrer le backend. Vérifiez PostgreSQL.", { message: error.message, stack: error.stack });
  console.error("Impossible de démarrer le backend. Vérifiez PostgreSQL.");
  console.error(error);
  process.exit(1);
});
