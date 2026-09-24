const env = require("../config/env");
const users = require("../repositories/userRepository");
const { hashPassword } = require("../security/password");

// Crée le compte administrateur de démarrage à partir des variables
// d'environnement ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD, une seule
// fois (idempotent : ne recrée rien si un compte avec cet email existe déjà,
// ne touche jamais un mot de passe déjà changé par l'admin depuis).
// Ne journalise JAMAIS l'email ni le mot de passe — contrairement au seed de
// démo (dev uniquement), ce compte n'est pas destiné à être visible dans les
// logs de production.
async function bootstrapAdmin() {
  const { email, password } = env.adminBootstrap;
  if (!email || !password) return;

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await users.findByEmail(normalizedEmail);
  if (existing) return;

  const { salt, hash } = hashPassword(password);
  await users.createUser({
    prenom: "Admin",
    nom: "SM Travel",
    email: normalizedEmail,
    dateNaissance: "1990-01-01",
    salt,
    hash,
    role: "ADMIN",
    emailVerified: true
  });
}

module.exports = { bootstrapAdmin };
