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

async function clearResetToken(id) {
  await query(
    "UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1",
    [id]
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
       (SELECT COUNT(*) FROM conversations WHERE sales_id = $1) AS conversations`,
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
  listByRole,
  updateIdentity,
  updateAvatar,
  setActive,
  setEmailVerificationCode,
  markEmailVerified,
  countSalesLinkedData,
  deleteById
};
