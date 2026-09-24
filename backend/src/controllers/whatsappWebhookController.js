const VERIFY_TOKEN = "smtravel-whatsapp-verify-2026";

function hubParam(req, name) {
  const nested = req.query.hub && req.query.hub[name];
  const dotted = req.query[`hub.${name}`];
  return nested || dotted || "";
}

function verifyWebhook(req, res) {
  const mode = String(hubParam(req, "mode") || "");
  const token = String(hubParam(req, "verify_token") || "");
  const challenge = String(hubParam(req, "challenge") || "");

  console.log("MODE =", mode);
  console.log("TOKEN =", token);
  console.log("CHALLENGE =", challenge);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED ✅");
    res.status(200).type("text/plain").send(challenge);
    return;
  }

  console.log("WEBHOOK REFUSED ❌");
  res.status(403).type("text/plain").send("Forbidden");
}

function receiveWebhook(req, res) {
  console.log("WHATSAPP MESSAGE:");
  console.log(typeof req.body === "string" ? req.body : JSON.stringify(req.body, null, 2));
  res.status(200).type("text/plain").send("EVENT_RECEIVED");
}

module.exports = { verifyWebhook, receiveWebhook };
