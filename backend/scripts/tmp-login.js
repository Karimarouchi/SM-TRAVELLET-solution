const { query } = require("../db");

async function main() {
  const result = await query(
    "SELECT email, last_login_at FROM users WHERE email IN ('sales@smtravel.fr', 'admin@smtravel.fr', 'adminrdv@smtravel.fr')"
  );
  console.log(result.rows.map((row) => `${row.email} ${row.last_login_at ? row.last_login_at.toISOString() : "null"}`).join("\n"));
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
