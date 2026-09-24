-- Phase A : rôles multiples. users.role reste la colonne "rôle de base"
-- (jamais supprimée, tout le code existant continue de fonctionner tel
-- quel) — élargie pour accepter RDV comme rôle de base (ex: un employé
-- uniquement RDV, sans être Sales). user_roles porte les rôles
-- ADDITIONNELS accordés à un utilisateur en plus de son rôle de base
-- (ex: un Sales qui est aussi RDV).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('STUDENT', 'SALES', 'ADMIN', 'RDV'));

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'SALES', 'ADMIN', 'RDV')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

-- Spécialisation des RDV par pays (géré depuis l'Admin) : quel(s) RDV
-- prennent en charge les dossiers visa d'un pays donné. Un pays peut avoir
-- plusieurs RDV (répartition de charge), un RDV peut couvrir plusieurs pays.
CREATE TABLE IF NOT EXISTS rdv_country_assignments (
  rdv_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rdv_user_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_rdv_country_assignments_country ON rdv_country_assignments (country_id);
