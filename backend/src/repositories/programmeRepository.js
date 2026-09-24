const { query } = require("../../db");

async function findAll() {
  const result = await query(
    `SELECT id, title, country, country_id, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order, details, created_at, updated_at
     FROM programmes
     ORDER BY display_order ASC, created_at ASC`
  );
  return result.rows;
}

async function findById(id) {
  const result = await query(
    `SELECT id, title, country, country_id, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order, details, created_at, updated_at
     FROM programmes
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function create(data) {
  const {
    title,
    country,
    countryId = null,
    degrees = "Licence / Master",
    description,
    imageUrl,
    badge = "Disponible",
    statusLabel = "Disponible",
    gradientStyle = "linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)",
    isFeatured = false,
    displayOrder = 0,
    details = []
  } = data;

  const result = await query(
    `INSERT INTO programmes (title, country, country_id, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order, details, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
     RETURNING id, title, country, country_id, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order, details, created_at, updated_at`,
    [title, country, countryId, degrees, description, imageUrl, badge, statusLabel, gradientStyle, isFeatured, displayOrder, JSON.stringify(details)]
  );
  return result.rows[0];
}

async function update(id, data) {
  const {
    title,
    country,
    countryId,
    degrees,
    description,
    imageUrl,
    badge,
    statusLabel,
    gradientStyle,
    isFeatured,
    displayOrder,
    details
  } = data;

  const result = await query(
    `UPDATE programmes
     SET title = $1,
         country = $2,
         country_id = $3,
         degrees = $4,
         description = $5,
         image_url = $6,
         badge = $7,
         status_label = $8,
         gradient_style = $9,
         is_featured = $10,
         display_order = $11,
         details = $12,
         updated_at = NOW()
     WHERE id = $13
     RETURNING id, title, country, country_id, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order, details, created_at, updated_at`,
    [title, country, countryId, degrees, description, imageUrl, badge, statusLabel, gradientStyle, isFeatured, displayOrder, JSON.stringify(details), id]
  );
  return result.rows[0] || null;
}

async function remove(id) {
  const result = await query(`DELETE FROM programmes WHERE id = $1 RETURNING id`, [id]);
  return (result.rowCount ?? 0) > 0;
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove
};
