-- Dossier « Reporté » : refus (université ou visa) qui sera retenté à une date
-- future (nouvelle session, nouveau dépôt de visa). Le dossier sort du pipeline
-- actif : aucun retard, tâche ni KPI n'est calculé dessus jusqu'à la relance.
ALTER TABLE university_applications DROP CONSTRAINT IF EXISTS university_applications_status_check;
ALTER TABLE university_applications ADD CONSTRAINT university_applications_status_check CHECK (status IN (
  'READY_TO_APPLY', 'APPLIED', 'WAITING_UNIVERSITY_RESPONSE',
  'INTERVIEW_REQUIRED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
  'ACCEPTED', 'REJECTED', 'CLOSED', 'POSTPONED'
));

ALTER TABLE university_applications
  ADD COLUMN IF NOT EXISTS postponed_kind VARCHAR(12),
  ADD COLUMN IF NOT EXISTS postponed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_on DATE,
  ADD COLUMN IF NOT EXISTS retry_intake VARCHAR(120),
  ADD COLUMN IF NOT EXISTS postponed_note TEXT,
  ADD COLUMN IF NOT EXISTS retry_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_of_id UUID REFERENCES university_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE university_applications DROP CONSTRAINT IF EXISTS university_applications_postponed_kind_check;
ALTER TABLE university_applications ADD CONSTRAINT university_applications_postponed_kind_check
  CHECK (postponed_kind IS NULL OR postponed_kind IN ('APPLICATION', 'VISA'));

CREATE INDEX IF NOT EXISTS idx_university_applications_retry_on ON university_applications (retry_on) WHERE status = 'POSTPONED';
