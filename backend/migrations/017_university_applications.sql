-- Phase B : modèle de candidature universitaire. Chaque tentative
-- (université) est une ligne séparée, jamais écrasée — un refus est
-- conservé, une nouvelle candidature ouvre une nouvelle ligne.
CREATE TABLE IF NOT EXISTS university_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES countries(id),
  university_id UUID NOT NULL REFERENCES country_universities(id),
  programme_id UUID REFERENCES programmes(id) ON DELETE SET NULL,
  sales_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_rdv_id UUID REFERENCES users(id) ON DELETE SET NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'READY_TO_APPLY',

  applied_at TIMESTAMPTZ,
  application_reference VARCHAR(120),
  notes TEXT,

  interview_date TIMESTAMPTZ,
  interview_type VARCHAR(20),
  interview_link TEXT,
  interview_instructions TEXT,

  decision_at TIMESTAMPTZ,
  decision_reason TEXT,
  acceptance_reference TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT university_applications_status_check CHECK (status IN (
    'READY_TO_APPLY', 'APPLIED', 'WAITING_UNIVERSITY_RESPONSE',
    'INTERVIEW_REQUIRED', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED',
    'ACCEPTED', 'REJECTED', 'CLOSED'
  )),
  CONSTRAINT university_applications_interview_type_check CHECK (
    interview_type IS NULL OR interview_type IN ('ONLINE', 'IN_PERSON')
  )
);

CREATE INDEX IF NOT EXISTS idx_university_applications_student ON university_applications (student_id);
CREATE INDEX IF NOT EXISTS idx_university_applications_sales ON university_applications (sales_id);
CREATE INDEX IF NOT EXISTS idx_university_applications_rdv ON university_applications (assigned_rdv_id);
CREATE INDEX IF NOT EXISTS idx_university_applications_status ON university_applications (status);

-- Historique / audit : chaque changement important est tracé, jamais écrasé.
CREATE TABLE IF NOT EXISTS application_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES university_applications(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_application_history_application ON application_history (application_id);
CREATE INDEX IF NOT EXISTS idx_application_history_student ON application_history (student_id);

-- Niveau A (dossier étudiant global) : DOCUMENTS → UNIVERSITY_APPLICATION → VISA → COMPLETED.
-- Reste volontairement séparé du statut fin de la candidature (niveau B, sur
-- university_applications.status) et du futur détail visa (niveau C).
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS dossier_stage VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTS';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_dossier_stage_check'
  ) THEN
    ALTER TABLE student_profiles ADD CONSTRAINT student_profiles_dossier_stage_check
      CHECK (dossier_stage IN ('DOCUMENTS', 'UNIVERSITY_APPLICATION', 'VISA', 'COMPLETED'));
  END IF;
END $$;
