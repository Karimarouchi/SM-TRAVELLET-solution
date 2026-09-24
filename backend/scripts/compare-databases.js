// Outil de vérification en LECTURE SEULE : compare le nombre de lignes par
// table entre la prod et la copie Supabase, pour confirmer visuellement
// qu'une sauvegarde a bien fonctionné. Ne modifie jamais rien.
//
// Usage : node backend/scripts/compare-databases.js

const { Client } = require("pg");
const env = require("../src/config/env");

async function countRowsByTable(connectionString) {
  const client = new Client({ connectionString, ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : false });
  await client.connect();
  try {
    const { rows: tables } = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    const counts = {};
    for (const { tablename } of tables) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM "${tablename}"`);
      counts[tablename] = rows[0].count;
    }
    return counts;
  } finally {
    await client.end();
  }
}

async function main() {
  if (!env.backup.supabaseDatabaseUrl) {
    console.error("SUPABASE_DATABASE_URL n'est pas défini dans backend/.env.");
    process.exit(1);
  }

  console.log("Lecture de la base de production...");
  const prod = await countRowsByTable(env.databaseUrl);

  console.log("Lecture de la copie Supabase...");
  const backup = await countRowsByTable(env.backup.supabaseDatabaseUrl);

  const allTables = Array.from(new Set([...Object.keys(prod), ...Object.keys(backup)])).sort();

  console.log("\nTable".padEnd(32), "Prod".padStart(8), "Supabase".padStart(10), "");
  console.log("-".repeat(56));

  let anyMismatch = false;
  for (const table of allTables) {
    const p = prod[table] ?? "—";
    const b = backup[table] ?? "—";
    const match = p === b;
    if (!match) anyMismatch = true;
    console.log(table.padEnd(32), String(p).padStart(8), String(b).padStart(10), match ? "" : "  ← différent");
  }

  console.log("-".repeat(56));
  if (anyMismatch) {
    console.log("\nDes différences existent — normal si des écritures ont eu lieu depuis la dernière sauvegarde.");
    console.log("Relancez `node backend/scripts/backup-to-supabase.js` puis ce script pour confirmer qu'elles disparaissent.");
  } else {
    console.log("\nLes deux bases ont exactement le même nombre de lignes par table. ✓");
  }
}

main().catch((err) => {
  console.error("Erreur :", err.message);
  process.exit(1);
});
