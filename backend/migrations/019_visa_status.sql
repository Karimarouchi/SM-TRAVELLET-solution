-- Niveau C : suivi détaillé du dossier visa, une fois la candidature
-- ACCEPTED et transférée au RDV. Vit sur la même ligne university_applications
-- (choix confirmé) : préparation → dossier déposé → décision (acceptée ou
-- refusée, refus = état final, tracé dans application_history).
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_status VARCHAR(20);
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_submitted_at TIMESTAMPTZ;
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_decision_at TIMESTAMPTZ;
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_decision_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'university_applications_visa_status_check'
  ) THEN
    ALTER TABLE university_applications ADD CONSTRAINT university_applications_visa_status_check
      CHECK (visa_status IS NULL OR visa_status IN ('PREPARATION', 'SUBMITTED', 'ACCEPTED', 'REJECTED'));
  END IF;
END $$;
