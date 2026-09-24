-- Entretien visa : le RDV peut planifier une réunion de préparation avec
-- l'étudiant (en ligne ou en présentiel) une fois le dossier visa déposé
-- (documents validés), et enregistrer la date du rendez-vous obtenu auprès
-- de l'ambassade/consulat. L'étudiant est notifié par email dans les deux cas.
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_prep_meeting_at TIMESTAMPTZ;
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_prep_meeting_type VARCHAR(20);
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_prep_meeting_location TEXT;
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_prep_meeting_instructions TEXT;
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_embassy_appointment_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'university_applications_visa_prep_meeting_type_check'
  ) THEN
    ALTER TABLE university_applications ADD CONSTRAINT university_applications_visa_prep_meeting_type_check
      CHECK (visa_prep_meeting_type IS NULL OR visa_prep_meeting_type IN ('ONLINE', 'IN_PERSON'));
  END IF;
END $$;
