const { query } = require("../../db");

async function findByEmail(email) {
  const result = await query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

async function createUser({ prenom, nom, email, dateNaissance, salt, hash, role = "STUDENT", emailVerified = true }) {
  const result = await query(
    `INSERT INTO users (prenom, nom, email, date_naissance, password_salt, password_hash, role, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [prenom, nom, email, dateNaissance, salt, hash, role, emailVerified]
  );
  return result.rows[0];
}

async function setEmailVerificationCode(id, code, expiresAt) {
  await query(
    "UPDATE users SET email_verification_code = $2, email_verification_expires_at = $3 WHERE id = $1",
    [id, code, expiresAt]
  );
}

async function markEmailVerified(id) {
  const result = await query(
    `UPDATE users
     SET email_verified = true, email_verification_code = NULL, email_verification_expires_at = NULL
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

async function touchLogin(id) {
  await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [id]);
}

async function updatePassword(id, salt, hash) {
  await query("UPDATE users SET password_salt = $2, password_hash = $3 WHERE id = $1", [id, salt, hash]);
}

async function setResetToken(id, token, expires) {
  await query(
    "UPDATE users SET password_reset_token = $2, password_reset_expires = $3 WHERE id = $1",
    [id, token, expires]
  );
}

async function findByResetToken(token) {
  const result = await query(
    "SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()",
    [token]
  );
  return result.rows[0] || null;
}

// Efface TOUT l'état de réinitialisation (code, essais, jeton) : après un
// changement réussi, ou quand le code est épuisé.
async function clearResetToken(id) {
  await query(
    `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL,
       password_reset_code_hash = NULL, password_reset_code_expires = NULL, password_reset_attempts = 0
     WHERE id = $1`,
    [id]
  );
}

// Nouveau code : remet les essais à zéro et annule un éventuel jeton précédent.
async function setResetCode(id, codeHash, expires) {
  await query(
    `UPDATE users SET password_reset_code_hash = $2, password_reset_code_expires = $3, password_reset_attempts = 0,
       password_reset_token = NULL, password_reset_expires = NULL
     WHERE id = $1`,
    [id, codeHash, expires]
  );
}

async function incrementResetAttempts(id) {
  const result = await query(
    "UPDATE users SET password_reset_attempts = password_reset_attempts + 1 WHERE id = $1 RETURNING password_reset_attempts",
    [id]
  );
  return result.rows[0]?.password_reset_attempts ?? 0;
}

// Code validé : il est consommé, et un jeton à usage unique prend le relais.
async function consumeResetCodeAndSetToken(id, tokenHash, expires) {
  await query(
    `UPDATE users SET password_reset_code_hash = NULL, password_reset_code_expires = NULL, password_reset_attempts = 0,
       password_reset_token = $2, password_reset_expires = $3
     WHERE id = $1`,
    [id, tokenHash, expires]
  );
}


async function listByRole(role) {
  const result = await query(
    "SELECT id, prenom, nom, email, role, is_active, created_at FROM users WHERE role = $1 ORDER BY created_at ASC",
    [role]
  );
  return result.rows;
}

async function updateAvatar(id, avatarUrl) {
  const result = await query("UPDATE users SET avatar_url = $2 WHERE id = $1 RETURNING *", [id, avatarUrl]);
  return result.rows[0] || null;
}

async function updateIdentity(id, { prenom, nom, dateNaissance }) {
  const result = await query(
    "UPDATE users SET prenom = $2, nom = $3, date_naissance = $4 WHERE id = $1 RETURNING *",
    [id, prenom, nom, dateNaissance]
  );
  return result.rows[0] || null;
}

async function setActive(id, isActive) {
  const result = await query(
    "UPDATE users SET is_active = $2 WHERE id = $1 RETURNING *",
    [id, Boolean(isActive)]
  );
  return result.rows[0] || null;
}

// Compte tout ce qui référence ce compte sales (étudiants assignés,
// candidatures, commissions, conversations) — sert à vérifier qu'un compte
// est réellement vide (créé par erreur) avant d'autoriser sa suppression
// définitive. Ne jamais supprimer un compte qui a la moindre donnée liée :
// utiliser "Transférer + Bloquer" à la place dans ce cas.
async function countSalesLinkedData(salesId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM student_profiles WHERE assigned_sales_id = $1) AS students,
       (SELECT COUNT(*) FROM university_applications WHERE sales_id = $1) AS applications,
       (SELECT COUNT(*) FROM commission_earnings WHERE user_id = $1) AS commissions,
       (SELECT COUNT(*) FROM whatsapp_contacts WHERE assigned_sales_id = $1)
         + (SELECT COUNT(*) FROM whatsapp_messages WHERE sent_by = $1) AS conversations`,
    [salesId]
  );
  const row = result.rows[0];
  return {
    students: Number(row.students),
    applications: Number(row.applications),
    commissions: Number(row.commissions),
    conversations: Number(row.conversations)
  };
}

// Ce qui disparaîtra avec un compte ÉTUDIANT (tout part en cascade en base) ou
// qui sera détaché. `commissions` est bloquant : ces gains appartiennent aux
// conseillers / RDV et ne doivent jamais être effacés en supprimant l'étudiant.
async function countStudentLinkedData(studentId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM student_documents WHERE student_id = $1) AS documents,
       (SELECT COUNT(*) FROM university_applications WHERE student_id = $1) AS applications,
       (SELECT COUNT(*) FROM commission_earnings WHERE student_id = $1) AS commissions,
       (SELECT COUNT(*) FROM whatsapp_contacts WHERE student_id = $1) AS whatsapp_contacts,
       (SELECT COUNT(*) FROM sales_codes WHERE used_by_student_id = $1) AS codes_used`,
    [studentId]
  );
  const row = result.rows[0];
  return {
    documents: Number(row.documents),
    applications: Number(row.applications),
    commissions: Number(row.commissions),
    whatsappContacts: Number(row.whatsapp_contacts),
    codesUsed: Number(row.codes_used)
  };
}

// Fichiers personnels de l'étudiant à supprimer du disque avec son compte.
async function listStudentFiles(studentId) {
  const [docs, user] = await Promise.all([
    query("SELECT stored_filename FROM student_documents WHERE student_id = $1 AND stored_filename IS NOT NULL", [studentId]),
    query("SELECT avatar_url FROM users WHERE id = $1", [studentId])
  ]);
  return {
    documents: docs.rows.map((r) => r.stored_filename),
    avatarUrl: user.rows[0]?.avatar_url || ""
  };
}

// Supprime un compte ÉTUDIANT. Les codes conseiller qu'il a utilisés partent
// avec lui : la base impose qu'un code « utilisé » ait toujours son étudiant,
// et le remettre en « non utilisé » le rendrait réutilisable par quelqu'un
// d'autre. Ils contiennent d'ailleurs son téléphone (pré-remplissage). Une
// seule instruction (CTE) : tout est supprimé ou rien.
async function deleteStudentById(id) {
  await query(
    `WITH removed_codes AS (DELETE FROM sales_codes WHERE used_by_student_id = $1)
     DELETE FROM users WHERE id = $1 AND role = 'STUDENT'`,
    [id]
  );
}

async function deleteById(id) {
  await query("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  touchLogin,
  updatePassword,
  setResetToken,
  findByResetToken,
  clearResetToken,
  setResetCode,
  incrementResetAttempts,
  consumeResetCodeAndSetToken,
  listByRole,
  updateIdentity,
  updateAvatar,
  setActive,
  setEmailVerificationCode,
  markEmailVerified,
  countSalesLinkedData,
  countStudentLinkedData,
  listStudentFiles,
  deleteStudentById,
  deleteById
};
