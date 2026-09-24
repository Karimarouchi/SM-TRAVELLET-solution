const { query } = require("../../db");

query(
  `UPDATE student_profiles
   SET onboarding_completed = FALSE, onboarding_completed_at = NULL
   WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
  ["demo@smtravel.fr"]
).then((result) => {
  console.log("Onboarding démo réinitialisé :", result.rowCount);
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
