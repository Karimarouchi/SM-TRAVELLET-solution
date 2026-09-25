// Simule un message WhatsApp entrant, signé comme le ferait Meta, envoyé au
// backend local — permet de tester toute la chaîne sans passer par Meta.
// Vérifie ensuite en base que le message a bien été enregistré.
//
// Usage : node backend/scripts/simulate-whatsapp-webhook.js [numéro] [texte]
// Exemple : node backend/scripts/simulate-whatsapp-webhook.js 21655480282 "Bonjour"
//
// Le backend doit tourner, avec WHATSAPP_APP_SECRET défini dans backend/.env
// (n'importe quelle valeur de test convient en local).

const crypto = require("crypto");
const env = require("../src/config/env");
const { query } = require("../db");

async function main() {
  if (!env.whatsapp.appSecret) {
    console.error("WHATSAPP_APP_SECRET n'est pas défini dans backend/.env.");
    process.exit(1);
  }

  const from = process.argv[2] || "21600000000";
  const text = process.argv[3] || "Bonjour, message de test";
  const waMessageId = `wamid.TEST_${Date.now()}`;

  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "TEST",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { phone_number_id: env.whatsapp.phoneNumberId || "TEST" },
          contacts: [{ wa_id: from, profile: { name: "Contact Test" } }],
          messages: [{ from, id: waMessageId, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }]
        }
      }]
    }]
  };

  const body = JSON.stringify(payload);
  const signature = `sha256=${crypto.createHmac("sha256", env.whatsapp.appSecret).update(body).digest("hex")}`;
  const url = `http://localhost:${env.port}/api/whatsapp/webhook`;

  const bad = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=deadbeef" }, body });
  console.log(`Signature invalide → HTTP ${bad.status} (attendu : 401)`);

  const good = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature }, body });
  console.log(`Signature valide   → HTTP ${good.status} (attendu : 200)`);

  // Le traitement se fait juste après la réponse 200 : on laisse une seconde.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const result = await query(
    `SELECT m.body, m.direction, c.phone, c.profile_name, c.student_id, c.assigned_sales_id
     FROM whatsapp_messages m JOIN whatsapp_contacts c ON c.id = m.contact_id
     WHERE m.wa_message_id = $1`,
    [waMessageId]
  );
  if (!result.rowCount) {
    console.error("ÉCHEC : message introuvable en base (voir backend/logs/error.log).");
    process.exit(1);
  }
  console.log("OK : message enregistré en base :", result.rows[0]);

  const again = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature }, body });
  await new Promise((resolve) => setTimeout(resolve, 500));
  const count = await query("SELECT COUNT(*)::int AS n FROM whatsapp_messages WHERE wa_message_id = $1", [waMessageId]);
  console.log(`Renvoi du même message (HTTP ${again.status}) → ${count.rows[0].n} ligne(s) en base (attendu : 1, pas de doublon)`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Erreur :", error.message);
  process.exit(1);
});
