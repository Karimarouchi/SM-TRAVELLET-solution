const { query } = require("../../db");

async function findAll() {
  const result = await query(
    `SELECT id, code, name, active, display_order, created_at, updated_at
     FROM countries
     ORDER BY display_order ASC, name ASC`
  );
  return result.rows;
}

async function findAllActive() {
  const result = await query(
    `SELECT id, code, name, active, display_order, created_at, updated_at
     FROM countries
     WHERE active = true
     ORDER BY display_order ASC, name ASC`
  );
  return result.rows;
}

async function findById(id) {
  const result = await query(
    `SELECT id, code, name, active, display_order, created_at, updated_at
     FROM countries
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByCode(code) {
  const result = await query(`SELECT id FROM countries WHERE code = $1`, [code]);
  return result.rows[0] || null;
}

async function findByName(name) {
  const result = await query(`SELECT id FROM countries WHERE name = $1`, [name]);
  return result.rows[0] || null;
}

async function findByNameCaseInsensitive(name) {
  const result = await query(`SELECT * FROM countries WHERE LOWER(name) = LOWER($1)`, [name]);
  return result.rows[0] || null;
}

async function maxDisplayOrder() {
  const result = await query(`SELECT COALESCE(MAX(display_order), 0) AS max FROM countries`);
  return result.rows[0].max;
}

async function create({ code, name, active = true, displayOrder = 0 }) {
  const result = await query(
    `INSERT INTO countries (code, name, active, display_order, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, code, name, active, display_order, created_at, updated_at`,
    [code, name, active, displayOrder]
  );
  return result.rows[0];
}

async function update(id, { code, name, displayOrder }) {
  const result = await query(
    `UPDATE countries
     SET code = $1,
         name = $2,
         display_order = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING id, code, name, active, display_order, created_at, updated_at`,
    [code, name, displayOrder, id]
  );
  return result.rows[0] || null;
}

async function setActive(id, active) {
  const result = await query(
    `UPDATE countries
     SET active = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, code, name, active, display_order, created_at, updated_at`,
    [active, id]
  );
  return result.rows[0] || null;
}

module.exports = {
  findAll,
  findAllActive,
  findById,
  findByCode,
  findByName,
  findByNameCaseInsensitive,
  maxDisplayOrder,
  create,
  update,
  setActive
};
