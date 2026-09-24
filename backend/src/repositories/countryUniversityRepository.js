const { query } = require("../../db");

async function findByCountry(countryId) {
  const result = await query(
    `SELECT id, country_id, name, active, display_order, created_at, updated_at
     FROM country_universities
     WHERE country_id = $1
     ORDER BY display_order ASC, name ASC`,
    [countryId]
  );
  return result.rows;
}

async function findActiveByCountryIds(countryIds) {
  if (!countryIds.length) return [];
  const result = await query(
    `SELECT cu.id, cu.country_id, cu.name, c.name AS country_name
     FROM country_universities cu
     JOIN countries c ON c.id = cu.country_id
     WHERE cu.active = true AND cu.country_id = ANY($1::uuid[])
     ORDER BY c.display_order ASC, cu.display_order ASC, cu.name ASC`,
    [countryIds]
  );
  return result.rows;
}

async function findById(id) {
  const result = await query(`SELECT * FROM country_universities WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function findByCountryAndName(countryId, name) {
  const result = await query(
    `SELECT id FROM country_universities WHERE country_id = $1 AND name = $2`,
    [countryId, name]
  );
  return result.rows[0] || null;
}

async function create({ countryId, name, displayOrder = 0 }) {
  const result = await query(
    `INSERT INTO country_universities (country_id, name, display_order, updated_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING *`,
    [countryId, name, displayOrder]
  );
  return result.rows[0];
}

async function update(id, { name, displayOrder }) {
  const result = await query(
    `UPDATE country_universities
     SET name = $1, display_order = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [name, displayOrder, id]
  );
  return result.rows[0] || null;
}

async function setActive(id, active) {
  const result = await query(
    `UPDATE country_universities SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [active, id]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  const result = await query(`DELETE FROM country_universities WHERE id = $1 RETURNING id`, [id]);
  return (result.rowCount ?? 0) > 0;
}

module.exports = {
  findByCountry,
  findActiveByCountryIds,
  findById,
  findByCountryAndName,
  create,
  update,
  setActive,
  remove
};
