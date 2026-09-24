const { query } = require("../../db");

async function findActiveRequirementsByCountryNames(names) {
  const lower = (names || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean);
  if (!lower.length) return [];
  const result = await query(
    `SELECT dr.id, dr.name, dr.description, dr.required, dr.accepted_file_types, dr.display_order,
            c.id AS country_id, c.name AS country_name, c.display_order AS country_display_order
     FROM document_requirements dr
     JOIN countries c ON c.id = dr.country_id
     WHERE dr.active = true AND c.active = true AND dr.category = 'DOSSIER' AND LOWER(c.name) = ANY($1::text[])
     ORDER BY c.display_order ASC, dr.display_order ASC, dr.name ASC`,
    [lower]
  );
  return result.rows;
}

async function findStudentDocumentsByRequirementIds(studentId, requirementIds) {
  if (!requirementIds.length) return [];
  const result = await query(
    `SELECT * FROM student_documents WHERE student_id = $1 AND document_requirement_id = ANY($2::uuid[])`,
    [studentId, requirementIds]
  );
  return result.rows;
}

async function upsertForRequirementIds(studentId, requirementIds, { fileUrl, originalFilename, storedFilename, mimeType, fileSize }) {
  const rows = [];
  for (const reqId of requirementIds) {
    const result = await query(
      `INSERT INTO student_documents
         (student_id, document_requirement_id, file_url, original_filename, stored_filename, mime_type, file_size, status, submitted_at, rejection_reason, reviewed_at, reviewed_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED', NOW(), NULL, NULL, NULL, NOW())
       ON CONFLICT (student_id, document_requirement_id)
       DO UPDATE SET file_url = $3, original_filename = $4, stored_filename = $5, mime_type = $6, file_size = $7,
                      status = 'SUBMITTED', submitted_at = NOW(), rejection_reason = NULL, reviewed_at = NULL, reviewed_by = NULL, updated_at = NOW()
       RETURNING *`,
      [studentId, reqId, fileUrl, originalFilename, storedFilename, mimeType, fileSize]
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

async function updateStatusForRequirementIds(studentId, requirementIds, status, reviewerId, reason) {
  if (!requirementIds.length) return [];
  const result = await query(
    `UPDATE student_documents
     SET status = $3,
         rejection_reason = $4,
         reviewed_by = $5,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE student_id = $1 AND document_requirement_id = ANY($2::uuid[])
     RETURNING *`,
    [studentId, requirementIds, status, reason || null, reviewerId]
  );
  return result.rows;
}

// Vérité brute pour le calcul READY_TO_APPLY : statut de chaque document
// obligatoire ET actif d'un pays, indépendamment de la fusion par nom
// utilisée pour l'affichage étudiant.
async function findRequiredActiveStatusesForCountry(countryId, studentId) {
  const result = await query(
    `SELECT dr.id, COALESCE(sd.status, 'PENDING') AS status
     FROM document_requirements dr
     LEFT JOIN student_documents sd ON sd.document_requirement_id = dr.id AND sd.student_id = $2
     WHERE dr.country_id = $1 AND dr.required = true AND dr.active = true AND dr.category = 'DOSSIER'`,
    [countryId, studentId]
  );
  return result.rows;
}

// Équivalent VISA de findActiveRequirementsByCountryNames, mais scopé à un
// seul pays (celui de la candidature) plutôt qu'à la liste des pays
// préférés — un dossier visa ne concerne qu'un seul pays à la fois.
async function findActiveVisaRequirementsByCountryId(countryId) {
  const result = await query(
    `SELECT dr.id, dr.name, dr.description, dr.required, dr.accepted_file_types, dr.display_order,
            c.id AS country_id, c.name AS country_name
     FROM document_requirements dr
     JOIN countries c ON c.id = dr.country_id
     WHERE dr.active = true AND c.active = true AND dr.category = 'VISA' AND dr.country_id = $1
     ORDER BY dr.display_order ASC, dr.name ASC`,
    [countryId]
  );
  return result.rows;
}

// Vérité brute pour le gate "documents visa validés avant dépôt" côté RDV.
async function findRequiredActiveVisaStatusesForCountry(countryId, studentId) {
  const result = await query(
    `SELECT dr.id, COALESCE(sd.status, 'PENDING') AS status
     FROM document_requirements dr
     LEFT JOIN student_documents sd ON sd.document_requirement_id = dr.id AND sd.student_id = $2
     WHERE dr.country_id = $1 AND dr.required = true AND dr.active = true AND dr.category = 'VISA'`,
    [countryId, studentId]
  );
  return result.rows;
}

module.exports = {
  findActiveRequirementsByCountryNames,
  findRequiredActiveStatusesForCountry,
  findStudentDocumentsByRequirementIds,
  upsertForRequirementIds,
  updateStatusForRequirementIds,
  findActiveVisaRequirementsByCountryId,
  findRequiredActiveVisaStatusesForCountry
};
