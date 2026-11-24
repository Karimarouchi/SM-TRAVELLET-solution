-- Entretien d'orientation : une fois les documents du pays validés, un RDV s'entretient avec
-- l'étudiant et choisit avec lui les universités (1 à 3) auxquelles il postulera.
CREATE TABLE IF NOT EXISTS student_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id),
  country_id UUID NOT NULL REFERENCES countries(id),
  rdv_id UUID REFERENCES users(id),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING',
  scheduled_at TIMESTAMPTZ,
  meet_link TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, country_id)
);
CREATE INDEX IF NOT EXISTS idx_student_interviews_rdv ON student_interviews (rdv_id, status);
