const { query } = require('../../db');

class AvisRepository {
  async findAll(status) {
    let sql = 'SELECT * FROM avis';
    const params = [];
    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY display_order ASC, created_at DESC';
    const result = await query(sql, params);
    return result.rows;
  }

  async findById(id) {
    const result = await query('SELECT * FROM avis WHERE id = $1', [id]);
    return result.rows[0];
  }

  async create(data) {
    const sql = `
      INSERT INTO avis (
        author_name, author_country, author_photo, programme, rating, content, source, student_id, status, display_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const params = [
      data.author_name,
      data.author_country,
      data.author_photo,
      data.programme,
      data.rating,
      data.content,
      data.source || 'manual',
      data.student_id,
      data.status || 'pending',
      data.display_order || 0
    ];
    const result = await query(sql, params);
    return result.rows[0];
  }

  async update(id, data) {
    const sql = `
      UPDATE avis SET
        author_name = COALESCE($1, author_name),
        author_country = COALESCE($2, author_country),
        author_photo = COALESCE($3, author_photo),
        programme = COALESCE($4, programme),
        rating = COALESCE($5, rating),
        content = COALESCE($6, content),
        status = COALESCE($7, status),
        display_order = COALESCE($8, display_order),
        updated_at = now()
      WHERE id = $9
      RETURNING *
    `;
    const params = [
      data.author_name,
      data.author_country,
      data.author_photo,
      data.programme,
      data.rating,
      data.content,
      data.status,
      data.display_order,
      id
    ];
    const result = await query(sql, params);
    return result.rows[0];
  }

  async updateStatus(id, status) {
    const result = await query(
      'UPDATE avis SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  }

  async delete(id) {
    await query('DELETE FROM avis WHERE id = $1', [id]);
    return true;
  }
}

module.exports = new AvisRepository();
