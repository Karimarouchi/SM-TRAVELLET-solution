-- Mot de passe oublié : l'utilisateur reçoit un code par email, le saisit,
-- puis choisit son nouveau mot de passe. Le code n'est jamais stocké en clair
-- (empreinte seulement) et s'efface après 5 essais ratés.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_reset_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_code_expires TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_reset_attempts INTEGER NOT NULL DEFAULT 0;
