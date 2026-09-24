const { query } = require("../../db");

async function findByCountry(countryId) {
  const result = await query(
    `SELECT id, country_id, name, description, required, active, display_order, accepted_file_types, category, created_at, updated_at
     FROM document_requirements
     WHERE country_id = $1
     ORDER BY category ASC, display_order ASC, name ASC`,
    [countryId]
  );
  return result.rows;
}

async function findById(id) {
  const result = await query(
    `SELECT id, country_id, name, description, required, active, display_order, accepted_file_types, category, created_at, updated_at
     FROM document_requirements
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByCountryAndName(countryId, name, category = "DOSSIER") {
  const result = await query(
    `SELECT id FROM document_requirements WHERE country_id = $1 AND name = $2 AND category = $3`,
    [countryId, name, category]
  );
  return result.rows[0] || null;
}

async function create({ countryId, name, description, required = true, displayOrder = 0, acceptedFileTypes = "IMAGE_PDF", category = "DOSSIER" }) {
  const result = await query(
    `INSERT INTO document_requirements (country_id, name, description, required, display_order, accepted_file_types, category, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, country_id, name, description, required, active, display_order, accepted_file_types, category, created_at, updated_at`,
    [countryId, name, description, required, displayOrder, acceptedFileTypes, category]
  );
  return result.rows[0];
}

async function update(id, { name, description, required, displayOrder, acceptedFileTypes, category }) {
  const result = await query(
    `UPDATE document_requirements
     SET name = $1,
         description = $2,
         required = $3,
         display_order = $4,
         accepted_file_types = $5,
         category = $6,
         updated_at = NOW()
     WHERE id = $7
     RETURNING id, country_id, name, description, required, active, display_order, accepted_file_types, category, created_at, updated_at`,
    [name, description, required, displayOrder, acceptedFileTypes, category, id]
  );
  return result.rows[0] || null;
}

async function setActive(id, active) {
  const result = await query(
    `UPDATE document_requirements
     SET active = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, country_id, name, description, required, active, display_order, accepted_file_types, category, created_at, updated_at`,
    [active, id]
  );
  return result.rows[0] || null;
}

async function countStudentDocuments(documentRequirementId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM student_documents WHERE document_requirement_id = $1`,
    [documentRequirementId]
  );
  return result.rows[0].count;
}

async function remove(id) {
  const result = await query(`DELETE FROM document_requirements WHERE id = $1 RETURNING id`, [id]);
  return (result.rowCount ?? 0) > 0;
}

module.exports = {
  findByCountry,
  findById,
  findByCountryAndName,
  create,
  update,
  setActive,
  countStudentDocuments,
  remove
};
