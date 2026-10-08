const crypto = require("crypto");
const env = require("../config/env");

// Chiffrement au repos (AES-256-GCM) des secrets saisis par le personnel.
// La clé dérive de JWT_SECRET : un export de la base seul ne les révèle pas.
function key() {
  return crypto.createHash("sha256").update(`portal-account:${env.jwtSecret}`).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

function decrypt(payload) {
  if (!payload) return "";
  try {
    const [iv, tag, data] = String(payload).split(".").map((part) => Buffer.from(part, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

module.exports = { encrypt, decrypt };
