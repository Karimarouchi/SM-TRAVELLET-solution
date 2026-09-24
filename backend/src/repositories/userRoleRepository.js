const { query } = require("../../db");

async function listAdditionalRoles(userId) {
  const result = await query("SELECT role FROM user_roles WHERE user_id = $1 ORDER BY role", [userId]);
  return result.rows.map((r) => r.role);
}

// Rôle de base (users.role) + rôles additionnels (user_roles), dédupliqués.
async function getEffectiveRoles(user) {
  const additional = await listAdditionalRoles(user.id);
  return Array.from(new Set([user.role, ...additional]));
}

async function setAdditionalRoles(userId, roles) {
  await query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
  for (const role of roles) {
    await query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT (user_id, role) DO NOTHING",
      [userId, role]
    );
  }
}

// "Charge active" d'un RDV = dossiers visa qu'il a en cours (transférés,
// décision pas encore rendue). Un dossier transféré reste au statut
// candidature ACCEPTED tant que le visa n'est pas tranché — c'est
// visa_status qui porte l'étape réelle, donc c'est lui qu'il faut compter.
const ACTIVE_VISA_LOAD_SQL = `
  ua.assigned_rdv_id = u.id
  AND ua.status = 'ACCEPTED'
  AND (ua.visa_status IS NULL OR ua.visa_status IN ('PREPARATION', 'SUBMITTED'))
`;

async function findRdvForCountry(countryId) {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom,
            COUNT(ua.id)::int AS active_load
     FROM rdv_country_assignments rca
     JOIN users u ON u.id = rca.rdv_user_id
     LEFT JOIN university_applications ua ON ${ACTIVE_VISA_LOAD_SQL}
     WHERE rca.country_id = $1 AND u.is_active = TRUE
     GROUP BY u.id, u.prenom, u.nom
     ORDER BY active_load ASC, u.prenom ASC`,
    [countryId]
  );
  return result.rows;
}

// Répartition équitable de secours : aucun RDV spécialisé sur ce pays, on
// choisit le RDV actif le moins chargé parmi TOUS les RDV actifs.
async function findLeastLoadedActiveRdv() {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom,
            COUNT(ua.id)::int AS active_load
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'RDV'
     LEFT JOIN university_applications ua ON ${ACTIVE_VISA_LOAD_SQL}
     WHERE (u.role = 'RDV' OR ur.role = 'RDV') AND u.is_active = TRUE
     GROUP BY u.id, u.prenom, u.nom
     ORDER BY active_load ASC, u.prenom ASC`
  );
  return result.rows;
}

// Pays sur lesquels un RDV donné est spécialisé — sert à lui ouvrir
// automatiquement la gestion des documents visa de CES pays, sans permission
// explicite à accorder en plus.
async function listCountriesForRdv(rdvUserId) {
  const result = await query(
    `SELECT country_id FROM rdv_country_assignments WHERE rdv_user_id = $1`,
    [rdvUserId]
  );
  return result.rows.map((r) => r.country_id);
}

async function listRdvAssignmentsForCountry(countryId) {
  const result = await query(
    `SELECT u.id, u.prenom, u.nom
     FROM rdv_country_assignments rca
     JOIN users u ON u.id = rca.rdv_user_id
     WHERE rca.country_id = $1
     ORDER BY u.prenom ASC`,
    [countryId]
  );
  return result.rows;
}

async function listAllRdvAssignments() {
  const result = await query(
    `SELECT rca.rdv_user_id, rca.country_id, u.prenom, u.nom, c.name AS country_name
     FROM rdv_country_assignments rca
     JOIN users u ON u.id = rca.rdv_user_id
     JOIN countries c ON c.id = rca.country_id
     ORDER BY c.display_order ASC, u.prenom ASC`
  );
  return result.rows;
}

async function setRdvCountries(rdvUserId, countryIds) {
  await query("DELETE FROM rdv_country_assignments WHERE rdv_user_id = $1", [rdvUserId]);
  for (const countryId of countryIds) {
    await query(
      "INSERT INTO rdv_country_assignments (rdv_user_id, country_id) VALUES ($1, $2) ON CONFLICT (rdv_user_id, country_id) DO NOTHING",
      [rdvUserId, countryId]
    );
  }
}

async function listUsersWithRole(role) {
  const result = await query(
    `SELECT DISTINCT u.id, u.prenom, u.nom, u.email, u.role AS base_role, u.is_active
     FROM users u
     WHERE u.role = $1
        OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = $1)
     ORDER BY u.prenom ASC`,
    [role]
  );
  return result.rows;
}

module.exports = {
  listAdditionalRoles,
  listUsersWithRole,
  getEffectiveRoles,
  setAdditionalRoles,
  findRdvForCountry,
  findLeastLoadedActiveRdv,
  listCountriesForRdv,
  listRdvAssignmentsForCountry,
  listAllRdvAssignments,
  setRdvCountries
};
