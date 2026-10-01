-- Passeport de l'étudiant : numéro et date d'expiration, saisis à l'onboarding.
-- Les étudiants déjà inscrits ne sont pas modifiés (colonnes vides).
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS passport_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS passport_expires_on DATE;
