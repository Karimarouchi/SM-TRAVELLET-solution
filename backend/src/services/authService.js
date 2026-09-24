const crypto = require("crypto");
const users = require("../repositories/userRepository");
const students = require("../repositories/studentRepository");
const sales = require("../repositories/salesRepository");
const { hashPassword, verifyPassword } = require("../security/password");
const { signToken } = require("../security/jwt");
const { userDto, studentProfileDto } = require("../dto/userDto");
const salesCodeService = require("./salesCodeService");
const emailService = require("./emailService");
const userRoles = require("../repositories/userRoleRepository");
const userPermissions = require("../repositories/userPermissionRepository");
const logger = require("../logger");

function generateVerificationCode() {
  return String(crypto.randomInt(0, 100000000)).padStart(8, "0");
}

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sendNewVerificationCode(user) {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await users.setEmailVerificationCode(user.id, code, expiresAt);
  try {
    await emailService.sendVerificationEmail(user.email, user.prenom, code);
  } catch (err) {
    logger.error("Échec de l'envoi de l'email de vérification", { message: err.message, stack: err.stack });
    throw fail("Impossible d'envoyer l'email de vérification. Réessayez dans quelques instants.", 502);
  }
}

function isAdultEnough(dateNaissance) {
  const birth = new Date(dateNaissance);
  if (Number.isNaN(birth.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - 16);
  return birth <= limit;
}

function validateRegister(body) {
  const nom = String(body.nom || "").trim();
  const prenom = String(body.prenom || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const dateNaissance = String(body.dateNaissance || "").trim();
  const password = String(body.password || "");
  const passwordConfirm = String(body.passwordConfirm || "");

  if (prenom.length < 2 || prenom.length > 40) return "Le prénom doit contenir entre 2 et 40 caractères.";
  if (nom.length < 2 || nom.length > 40) return "Le nom doit contenir entre 2 et 40 caractères.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Adresse email invalide.";
  if (!isAdultEnough(dateNaissance)) return "Vous devez avoir au moins 16 ans.";
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (password !== passwordConfirm) return "Les mots de passe ne correspondent pas.";
  return { nom, prenom, email, dateNaissance, password };
}

async function buildSession(user) {
  let onboardingCompleted = true;
  let profile = null;

  if (user.role === "STUDENT") {
    const row = await students.ensureProfile(user.id);
    profile = studentProfileDto(row);
    onboardingCompleted = Boolean(profile.onboardingCompleted);
    if (row?.assigned_sales_id) {
      const advisor = await users.findById(row.assigned_sales_id);
      if (advisor) profile.assignedSalesName = `${advisor.prenom} ${advisor.nom}`.trim();
    }
  } else if (user.role === "SALES") {
    await sales.ensureProfile(user.id);
  }

  const roles = await userRoles.getEffectiveRoles(user);
  const permissions = roles.includes("ADMIN") ? [] : await userPermissions.listForUser(user.id);

  return {
    token: signToken(user, roles, permissions),
    user: userDto(user, { onboardingCompleted, roles, permissions }),
    profile
  };
}

async function register(body) {
  const parsed = validateRegister(body);
  if (typeof parsed === "string") {
    const error = new Error(parsed);
    error.status = 400;
    throw error;
  }
  if (await users.findByEmail(parsed.email)) {
    const error = new Error("Un compte existe déjà avec cet email.");
    error.status = 409;
    throw error;
  }
  // Validé AVANT la création du compte : un code invalide ne doit jamais
  // faire échouer l'inscription après coup (compte déjà créé).
  await salesCodeService.assertCodeUsable(body.salesCode);

  const { salt, hash } = hashPassword(parsed.password);
  const user = await users.createUser({ ...parsed, salt, hash, role: "STUDENT", emailVerified: false });
  await students.ensureProfile(user.id);
  // Un code Sales est optionnel : s'il est absent, le mécanisme d'attribution
  // existant (manuel/auto par charge) continue de s'appliquer normalement.
  if (body.salesCode) {
    await salesCodeService.applyCodeToNewStudent(user.id, body.salesCode);
  }
  try {
    await sendNewVerificationCode(user);
  } catch (err) {
    // Le compte existe déjà : on n'échoue pas l'inscription pour un souci
    // d'envoi d'email, l'étudiant pourra redemander un code (resend).
    logger.error("Email de vérification non envoyé à l'inscription", { message: err.message, stack: err.stack });
  }
  return buildSession(user);
}

async function verifyEmail(userId, rawCode) {
  const user = await users.findById(userId);
  if (!user) throw fail("Compte introuvable.", 404);
  if (user.email_verified) return buildSession(user);

  const code = String(rawCode || "").trim();
  if (!code) throw fail("Code de vérification manquant.", 400);
  if (!user.email_verification_code || user.email_verification_code !== code) {
    throw fail("Code de vérification incorrect.", 400);
  }
  if (!user.email_verification_expires_at || new Date(user.email_verification_expires_at) <= new Date()) {
    throw fail("Ce code a expiré. Demandez-en un nouveau.", 400);
  }
  const updated = await users.markEmailVerified(userId);
  return buildSession(updated);
}

async function resendVerificationCode(userId) {
  const user = await users.findById(userId);
  if (!user) throw fail("Compte introuvable.", 404);
  if (user.email_verified) return { ok: true, alreadyVerified: true };
  await sendNewVerificationCode(user);
  return { ok: true };
}

async function login(email, password) {
  const user = await users.findByEmail(String(email || "").trim().toLowerCase());
  if (!user || !verifyPassword(String(password || ""), user.password_salt, user.password_hash)) {
    const error = new Error("Email ou mot de passe incorrect.");
    error.status = 401;
    throw error;
  }
  if (user.is_active === false) {
    const error = new Error("Ce compte est inactif. Contactez l’administrateur.");
    error.status = 403;
    throw error;
  }
  await users.touchLogin(user.id);
  return buildSession(user);
}

async function me(userId) {
  const user = await users.findById(userId);
  if (!user) {
    const error = new Error("Compte introuvable.");
    error.status = 401;
    throw error;
  }
  return buildSession(user);
}

async function changePassword(userId, currentPassword, nextPassword) {
  const user = await users.findById(userId);
  if (!user || !verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
    const error = new Error("Mot de passe actuel incorrect.");
    error.status = 400;
    throw error;
  }
  if (!nextPassword || nextPassword.length < 8) {
    const error = new Error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
    error.status = 400;
    throw error;
  }
  const { salt, hash } = hashPassword(nextPassword);
  await users.updatePassword(userId, salt, hash);
  return { ok: true };
}

async function forgotPassword(email) {
  const user = await users.findByEmail(String(email || "").trim().toLowerCase());
  if (!user) return { ok: true };
  const token = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 30);
  await users.setResetToken(user.id, token, expires);
  if (process.env.NODE_ENV === "production") {
    // TODO: brancher un envoi d'email réel (SMTP/SendGrid/etc.) avant la mise en production.
    // Le token ne doit jamais apparaître dans les logs serveur en production.
  } else {
    console.log(`Reset password pour ${user.email} : ${token}`);
  }
  return { ok: true, message: "Si un compte existe, un lien de réinitialisation a été généré." };
}

async function resetPassword(token, password) {
  const user = await users.findByResetToken(String(token || ""));
  if (!user) {
    const error = new Error("Lien de réinitialisation invalide ou expiré.");
    error.status = 400;
    throw error;
  }
  if (!password || password.length < 8) {
    const error = new Error("Le mot de passe doit contenir au moins 8 caractères.");
    error.status = 400;
    throw error;
  }
  const { salt, hash } = hashPassword(password);
  await users.updatePassword(user.id, salt, hash);
  await users.clearResetToken(user.id);
  return { ok: true };
}

module.exports = { register, login, me, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerificationCode };
