const fs = require("fs");
const path = require("path");
const { query } = require("../../db");

async function migrate() {
  const { ensureUsersTable } = require("../../db");
  await ensureUsersTable();
  const dir = path.join(__dirname, "../../migrations");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const file of files) {
    const applied = await query("SELECT id FROM schema_migrations WHERE id = $1", [file]);
    if (applied.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await query(sql);
    await query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
    console.log(`Migration appliquée : ${file}`);
  }
}

module.exports = { migrate };
