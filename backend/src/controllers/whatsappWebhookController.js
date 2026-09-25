const env = require("../config/env");
const logger = require("../logger");
const whatsappService = require("../services/whatsappService");

function hubParam(req, name) {
  const nested = req.query.hub && req.query.hub[name];
  const dotted = req.query[`hub.${name}`];
  return String(nested || dotted || "");
}

function verifyWebhook(req, res) {
  if (!env.whatsapp.verifyToken) {
    res.status(503).type("text/plain").send("WhatsApp non configuré (WHATSAPP_VERIFY_TOKEN).");
    return;
  }
  if (hubParam(req, "mode") === "subscribe" && hubParam(req, "verify_token") === env.whatsapp.verifyToken) {
    logger.info("WhatsApp : webhook vérifié par Meta.");
    res.status(200).type("text/plain").send(hubParam(req, "challenge"));
    return;
  }
  logger.warn("WhatsApp : vérification du webhook refusée (verify token incorrect).");
  res.status(403).type("text/plain").send("Forbidden");
}

function receiveWebhook(req, res) {
  if (!env.whatsapp.appSecret) {
    res.status(503).type("text/plain").send("WhatsApp non configuré (WHATSAPP_APP_SECRET).");
    return;
  }
  if (!whatsappService.isValidSignature(req.rawBody, req.get("x-hub-signature-256"))) {
    logger.warn("WhatsApp : webhook rejeté (signature X-Hub-Signature-256 invalide).");
    res.status(401).type("text/plain").send("Invalid signature");
    return;
  }

  // Meta exige une réponse rapide : on accuse réception tout de suite, le
  // traitement se fait ensuite et ses erreurs ne remontent jamais à Meta.
  res.status(200).type("text/plain").send("EVENT_RECEIVED");
  whatsappService.processWebhook(req.body).catch((error) => {
    logger.error("WhatsApp : échec du traitement du webhook", { message: error.message });
  });
}

module.exports = { verifyWebhook, receiveWebhook };
