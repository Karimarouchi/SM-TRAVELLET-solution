-- Compte créé sur la plateforme de l'université au dépôt de la candidature :
-- identifiant, mot de passe (chiffré AES-256-GCM) et lien de la plateforme (facultatif).
ALTER TABLE university_applications
  ADD COLUMN IF NOT EXISTS portal_login VARCHAR(200),
  ADD COLUMN IF NOT EXISTS portal_password_enc TEXT,
  ADD COLUMN IF NOT EXISTS portal_url VARCHAR(500);
