const { query } = require("../../db");

// Un « vœu » (student_university_choices) = une université + une filière visées
// par un étudiant. Il compte dans la limite des candidatures simultanées tant
// qu'il n'est pas retiré et que sa candidature n'est pas refusée ou clôturée.

// db : client de transaction optionnel (même signature que query).
function exec(db) {
  return db ? (text, params) => db.query(text, params) : query;
}

const SELECT_CHOICE = `
  SELECT ch.*, c.name AS country_name, cu.name AS university_name, cu.source AS university_source,
         la.id AS application_id, la.status AS application_status
  FROM student_university_choices ch
  JOIN countries c ON c.id = ch.country_id
  JOIN country_universities cu ON cu.id = ch.university_id
  LEFT JOIN LATERAL (
    SELECT id, status FROM university_applications WHERE choice_id = ch.id ORDER BY created_at DESC LIMIT 1
  ) la ON TRUE`;

const ACTIVE = `ch.withdrawn_at IS NULL AND COALESCE(la.status, '') NOT IN ('REJECTED', 'CLOSED', 'POSTPONED')`;

async function listActiveForStudent(studentId, db) {
  const result = await exec(db)(`${SELECT_CHOICE} WHERE ch.student_id = $1 AND ${ACTIVE} ORDER BY ch.created_at ASC`, [studentId]);
  return result.rows;
}

// Étudiants qui visent actuellement cette université (vœu non retiré, candidature non terminée).
async function listActiveStudentIdsForUniversity(universityId) {
  const result = await query(`${SELECT_CHOICE} WHERE ch.university_id = $1 AND ${ACTIVE}`, [universityId]);
  return [...new Set(result.rows.map((row) => row.student_id))];
}

async function countActive(studentId, db) {
  const rows = await listActiveForStudent(studentId, db);
  return rows.length;
}

async function findById(id) {
  const result = await query(`${SELECT_CHOICE} WHERE ch.id = $1`, [id]);
  return result.rows[0] || null;
}

// A-t-il déjà eu un vœu (même retiré) ? Sert à ne pas recréer le vœu issu de
// la fiche si l'étudiant l'a volontairement retiré.
async function hasAnyForStudent(studentId) {
  const result = await query("SELECT 1 FROM student_university_choices WHERE student_id = $1 LIMIT 1", [studentId]);
  return result.rowCount > 0;
}

async function create({ studentId, countryId, universityId, fieldOfStudy, addedBy, addedByRole }, db) {
  const result = await exec(db)(
    `INSERT INTO student_university_choices (student_id, country_id, university_id, field_of_study, added_by, added_by_role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [studentId, countryId, universityId, fieldOfStudy, addedBy || null, addedByRole]
  );
  return result.rows[0];
}

async function withdraw(id) {
  await query("UPDATE student_university_choices SET withdrawn_at = NOW() WHERE id = $1 AND withdrawn_at IS NULL", [id]);
}

// Le conseiller suit-il au moins un étudiant qui vise cette université ?
async function salesManagesUniversity(salesId, universityId) {
  const result = await query(
    `SELECT 1 FROM student_university_choices ch
     JOIN student_profiles sp ON sp.user_id = ch.student_id
     WHERE ch.university_id = $1 AND sp.assigned_sales_id = $2 LIMIT 1`,
    [universityId, salesId]
  );
  return result.rowCount > 0;
}

// Ajoute le pays aux pays préférés du profil (pour que ses documents communs
// apparaissent dans la checklist), sans doublon.
async function addPreferredCountry(studentId, countryName) {
  await query(
    `UPDATE student_profiles
     SET preferred_countries = array_append(COALESCE(preferred_countries, ARRAY[]::text[]), $2::text), updated_at = NOW()
     WHERE user_id = $1
       AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(preferred_countries, ARRAY[]::text[])) AS x WHERE LOWER(x) = LOWER($2::text))`,
    [studentId, countryName]
  );
}

// Verrou par étudiant pour que deux ajouts simultanés ne dépassent pas la limite.
async function lockStudent(db, studentId) {
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`choices:${studentId}`]);
}

module.exports = { addPreferredCountry, lockStudent, listActiveForStudent, listActiveStudentIdsForUniversity, countActive, findById, hasAnyForStudent, create, withdraw, salesManagesUniversity };
