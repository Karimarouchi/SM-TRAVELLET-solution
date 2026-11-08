const env = require("../config/env");
const users = require("../repositories/userRepository");
const { hashPassword } = require("../security/password");
const { query } = require("../../db");

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
  // Un admin qui a changé son adresse de connexion ne doit pas faire renaître un second admin
  // avec l'ancienne adresse et le mot de passe de démarrage : on ne crée que s'il n'y a aucun admin.
  const { rows } = await query(
    "SELECT 1 FROM users u WHERE u.role = 'ADMIN' OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'ADMIN') LIMIT 1"
  );
  if (rows.length) return;

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
