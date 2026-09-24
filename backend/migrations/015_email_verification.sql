-- Vérification d'email par code à 8 chiffres envoyé lors de l'inscription.
-- DEFAULT true : tous les comptes déjà existants sont considérés comme
-- vérifiés (décision validée) ; les nouvelles inscriptions le mettent
-- explicitement à false au moment de la création du compte.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_code VARCHAR(8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
