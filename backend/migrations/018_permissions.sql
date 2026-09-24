-- Permissions granulaires, orthogonales aux rôles : un utilisateur non-ADMIN
-- (ex: un SALES) peut recevoir une permission précise (ex: gérer les
-- programmes) sans devenir administrateur complet. ADMIN a toujours toutes
-- les permissions implicitement (jamais besoin de lignes ici pour un ADMIN).
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(40) NOT NULL CHECK (permission IN ('MANAGE_PROGRAMMES', 'MANAGE_COUNTRIES', 'MANAGE_AVIS')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, permission)
);
