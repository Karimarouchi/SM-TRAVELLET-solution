const crypto = require("crypto");
const users = require("../repositories/userRepository");
const students = require("../repositories/studentRepository");
const sales = require("../repositories/salesRepository");
const { hashPassword, verifyPassword } = require("../security/password");
const { signToken } = require("../security/jwt");
const { userDto, studentProfileDto } = require("../dto/userDto");
const salesCodeService = require("./salesCodeService");
const notificationService = require("./notificationService");
const whatsappService = require("./whatsappService");
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
  // Format international : "+" suivi de l'indicatif pays et du numéro.
  const phone = String(body.phone || "").replace(/[\s.-]/g, "");
  if (!/^\+\d{8,15}$/.test(phone)) return "Numéro de téléphone invalide (indicatif pays + numéro).";
  return { nom, prenom, email, dateNaissance, password, phone };
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
  if (await students.findStudentIdByPhone(whatsappService.normalizePhone(parsed.phone))) {
    const error = new Error("Ce numéro de téléphone est déjà utilisé par un autre compte.");
    error.status = 409;
    throw error;
  }
  // Validé AVANT la création du compte : un code invalide ne doit jamais
  // faire échouer l'inscription après coup (compte déjà créé).
  await salesCodeService.assertCodeUsable(body.salesCode);

  const { salt, hash } = hashPassword(parsed.password);
  const { phone, ...account } = parsed;
  const user = await users.createUser({ ...account, salt, hash, role: "STUDENT", emailVerified: false });
  await students.ensureProfile(user.id);
  await students.setPhone(user.id, phone);
  // Un code Sales est optionnel : s'il est absent, le mécanisme d'attribution
  // existant (manuel/auto par charge) continue de s'appliquer normalement.
  if (body.salesCode) {
    await salesCodeService.applyCodeToNewStudent(user.id, body.salesCode);
  }
  // Ce numéro a déjà écrit au WhatsApp de l'agence : la conversation est
  // liée tout de suite au nouveau compte.
  await whatsappService.linkStudentByPhone(user.id, phone);
  await notificationService.notifyAdmins({
    type: "STUDENT_REGISTERED",
    title: "Nouvel étudiant inscrit",
    body: `${user.prenom} ${user.nom} (${user.email}) vient de créer son compte.`,
    link: `/conseiller/etudiants/${user.id}`
  });
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

const RESET_CODE_TTL_MS = 1000 * 60 * 15;
const RESET_TOKEN_TTL_MS = 1000 * 60 * 10;
const RESET_COOLDOWN_MS = 1000 * 60;
const RESET_MAX_ATTEMPTS = 5;
const RESET_REPLY = {
  ok: true,
  message: "Si un compte existe avec cette adresse, un email contenant un code de vérification vient d'être envoyé."
};

function resetError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

// Ni le code ni le jeton ne sont JAMAIS stockés tels quels : seule leur
// empreinte SHA-256 l'est (le code est lié à l'identifiant du compte, pour
// qu'un même code donne deux empreintes différentes).
const sha256 = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const hashResetCode = (userId, code) => sha256(`${userId}:${code}`);
const hashResetToken = (token) => sha256(token);

// Étape 1 — envoie un code à 8 chiffres par email. La réponse est identique
// que le compte existe ou non (on ne révèle pas quelles adresses sont
// inscrites), et l'envoi se fait en arrière-plan pour que le temps de réponse
// ne le révèle pas non plus.
async function forgotPassword(email) {
  const address = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return RESET_REPLY;

  const user = await users.findByEmail(address);
  if (!user || user.is_active === false) return RESET_REPLY;

  // Anti-spam : pas de nouvel email si un code vient d'être envoyé (il vit 15
  // min, donc « créé il y a moins d'une minute » = expire dans plus de 14 min).
  const expiresAt = user.password_reset_code_expires ? new Date(user.password_reset_code_expires).getTime() : 0;
  if (expiresAt - Date.now() > RESET_CODE_TTL_MS - RESET_COOLDOWN_MS) return RESET_REPLY;

  const code = generateVerificationCode();
  await users.setResetCode(user.id, hashResetCode(user.id, code), new Date(Date.now() + RESET_CODE_TTL_MS));
  emailService.sendPasswordResetEmail(user.email, user.prenom, code).catch((error) => {
    logger.error("Échec de l'envoi de l'email de réinitialisation", { message: error.message });
  });
  return RESET_REPLY;
}

// Étape 2 — vérifie le code. Le message d'erreur est toujours le même (code
// faux, expiré, compte inconnu ou essais épuisés) pour ne rien révéler. Après
// 5 erreurs le code est détruit : 10^8 combinaisons ne se devinent pas à 5 essais.
async function verifyResetCode(email, code) {
  const invalid = () => resetError("Code incorrect ou expiré. Vérifiez le code reçu par email, ou demandez-en un nouveau.");
  const address = String(email || "").trim().toLowerCase();
  const entered = String(code || "").trim();
  const user = address ? await users.findByEmail(address) : null;

  if (
    !user ||
    user.is_active === false ||
    !user.password_reset_code_hash ||
    !user.password_reset_code_expires ||
    new Date(user.password_reset_code_expires).getTime() < Date.now() ||
    user.password_reset_attempts >= RESET_MAX_ATTEMPTS ||
    !/^\d{8}$/.test(entered)
  ) {
    // Un code mal formé compte aussi comme un essai quand une demande est en cours.
    if (user && user.password_reset_code_hash && user.password_reset_attempts < RESET_MAX_ATTEMPTS) {
      const attempts = await users.incrementResetAttempts(user.id);
      if (attempts >= RESET_MAX_ATTEMPTS) await users.clearResetToken(user.id);
    }
    throw invalid();
  }

  const expected = Buffer.from(user.password_reset_code_hash, "hex");
  const actual = Buffer.from(hashResetCode(user.id, entered), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    const attempts = await users.incrementResetAttempts(user.id);
    if (attempts >= RESET_MAX_ATTEMPTS) await users.clearResetToken(user.id);
    throw invalid();
  }

  // Code juste : il est consommé, un jeton à usage unique autorise le changement.
  const token = crypto.randomBytes(32).toString("hex");
  await users.consumeResetCodeAndSetToken(user.id, hashResetToken(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));
  return { ok: true, resetToken: token };
}

// Étape 3 — choisit le nouveau mot de passe, avec le jeton obtenu à l'étape 2.
async function resetPassword(token, password) {
  const raw = String(token || "");
  const user = /^[0-9a-f]{64}$/i.test(raw) ? await users.findByResetToken(hashResetToken(raw)) : null;
  if (!user) {
    const error = new Error("Cette étape a expiré. Recommencez la demande de mot de passe oublié.");
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
  // Le jeton ne sert qu'une fois.
  await users.clearResetToken(user.id);
  return { ok: true };
}

module.exports = { register, login, me, changePassword, forgotPassword, verifyResetCode, resetPassword, verifyEmail, resendVerificationCode };
