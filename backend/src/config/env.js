const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  smtp: {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    fromName: process.env.SMTP_FROM_NAME || "SM Travel"
  },
  adminBootstrap: {
    email: process.env.ADMIN_BOOTSTRAP_EMAIL || "",
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD || ""
  },
  // Sauvegarde à sens unique vers Supabase (voir backend/scripts/README.md) —
  // volontairement optionnel : l'app démarre normalement tant que ce n'est
  // pas configuré, seuls les scripts de backup en ont besoin.
  backup: {
    supabaseDatabaseUrl: process.env.SUPABASE_DATABASE_URL || "",
    alertEmail: process.env.BACKUP_ALERT_EMAIL || "",
    // Optionnel — nécessaire seulement si pg_dump/pg_restore ne sont pas
    // dans le PATH (typiquement en dev local sur Windows). Vide en
    // production : le PATH de l'image Docker suffit.
    pgDumpPath: process.env.PG_DUMP_PATH || "",
    pgRestorePath: process.env.PG_RESTORE_PATH || ""
  }
};
