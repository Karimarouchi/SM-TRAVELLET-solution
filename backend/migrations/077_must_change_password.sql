-- Mot de passe provisoire donné par l'admin : l'employé doit le changer à sa prochaine connexion.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
