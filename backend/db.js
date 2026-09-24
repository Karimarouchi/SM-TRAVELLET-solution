const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:Karim123@localhost:5432/sm_travel";

const pool = new Pool({
  connectionString,
  max: 10
});

async function query(text, params) {
  return pool.query(text, params);
}

function adminConnectionString() {
  const url = new URL(connectionString);
  url.pathname = "/postgres";
  return url.toString();
}

async function ensureDatabase() {
  const dbName = new URL(connectionString).pathname.replace("/", "") || "sm_travel";
  const admin = new Pool({ connectionString: adminConnectionString(), max: 1 });
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!existing.rowCount) {
      await admin.query(`CREATE DATABASE ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

async function ensureUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nom VARCHAR(40) NOT NULL,
      prenom VARCHAR(40) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      date_naissance DATE NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

module.exports = { pool, query, ensureDatabase, ensureUsersTable };
