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
  // Adresse publique du site, pour les liens envoyés aux étudiants (ex. lien
  // d'inscription avec code pré-rempli envoyé par WhatsApp).
  appPublicUrl: (process.env.APP_PUBLIC_URL || "https://sm.antigoneinterne.agency").replace(/\/+$/, ""),
  // Google Calendar : création automatique des liens Meet (voir
  // backend/GOOGLE_CALENDAR.md). Optionnel : sans ces variables, les liens
  // Meet se collent à la main comme avant.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    // Doit être enregistrée à l'identique dans Google Cloud (URI de
    // redirection autorisés).
    redirectUri: process.env.GOOGLE_REDIRECT_URI || ""
  },
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
  },
  // WhatsApp Business Cloud API (voir backend/WHATSAPP.md) — optionnel :
  // sans ces variables l'app démarre, seules les routes WhatsApp répondent 503.
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || "v23.0"
  }
};
