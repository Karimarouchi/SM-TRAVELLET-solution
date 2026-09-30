-- Pipeline : Meet optionnel (RDV / étudiant) avant dépôt, documents visa
-- validés par le Sales, puis retour au même RDV. Commission Sales sur cette
-- validation. Horaires de travail pour les stats Admin.

ALTER TABLE university_applications
  ADD COLUMN IF NOT EXISTS staff_meet_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS staff_meet_link TEXT,
  ADD COLUMN IF NOT EXISTS staff_meet_instructions TEXT,
  ADD COLUMN IF NOT EXISTS visa_docs_validated_at TIMESTAMPTZ;

ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_stage_check;
ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_stage_check CHECK (stage IN (
  'CODE_CLAIMED', 'DOCUMENTS_VALIDATED', 'APPLIED', 'ACCEPTED',
  'VISA_DOCUMENTS_VALIDATED', 'VISA_SUBMITTED', 'VISA_ACCEPTED'
));

INSERT INTO app_settings (key, value, updated_at) VALUES
  ('work_days', '1,2,3,4,5', NOW()),
  ('work_start', '09:00', NOW()),
  ('work_end', '18:00', NOW()),
  ('work_timezone', 'Africa/Tunis', NOW()),
  ('work_halfway_minutes', '960', NOW())
ON CONFLICT (key) DO NOTHING;
