const googleCalendar = require("../services/googleCalendarService");
const env = require("../config/env");
const { authRoles } = require("../security/rbac");

function handle(res, error) {
  return res.status(error.status || 400).json({ error: error.message || "Requête invalide." });
}

// État de la connexion. L'adresse du compte n'est donnée qu'à l'admin ; les
// RDV n'ont besoin que de savoir si le bouton « Créer le lien Meet » marche.
async function status(req, res) {
  try {
    const full = await googleCalendar.getStatus();
    if (authRoles(req.auth).includes("ADMIN")) return res.json(full);
    res.json({ configured: full.configured, connected: full.connected });
  } catch (error) {
    handle(res, error);
  }
}

async function connect(req, res) {
  try {
    res.json({ url: googleCalendar.buildAuthUrl(req.auth.sub) });
  } catch (error) {
    handle(res, error);
  }
}

async function disconnect(req, res) {
  try {
    await googleCalendar.disconnect();
    res.json({ connected: false });
  } catch (error) {
    handle(res, error);
  }
}

// Retour de Google après le consentement : appelé par le navigateur de
// l'admin (pas d'en-tête Authorization), l'identité vient du « state » signé.
// On le renvoie ensuite vers Paramètres avec le résultat.
async function callback(req, res) {
  const back = (params) => res.redirect(`${env.appPublicUrl}/app/#/admin/settings?${new URLSearchParams(params)}`);
  if (req.query.error) {
    return back({ google: "error", reason: req.query.error === "access_denied" ? "Connexion annulée sur l'écran Google." : String(req.query.error) });
  }
  try {
    await googleCalendar.handleCallback(req.query.code, req.query.state);
    back({ google: "connected" });
  } catch (error) {
    back({ google: "error", reason: error.message });
  }
}

module.exports = { status, connect, disconnect, callback };
