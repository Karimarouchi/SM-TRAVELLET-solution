-- Traductions demandées par le conseiller (ou l'admin) sur un document validé : un champ « traduction » s'ouvre
-- pour l'étudiant et pour le conseiller. Tant qu'une traduction demandée n'est pas validée, la candidature ne peut pas être déposée.
CREATE TABLE IF NOT EXISTS student_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_name VARCHAR(200) NOT NULL,
  university_id UUID,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(12) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUBMITTED', 'VALIDATED', 'REJECTED')),
  file_url VARCHAR(255),
  original_filename VARCHAR(255),
  stored_filename VARCHAR(255),
  mime_type VARCHAR(120),
  file_size INTEGER,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason VARCHAR(500)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_translations_doc
  ON student_translations (student_id, doc_name, COALESCE(university_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_student_translations_student ON student_translations (student_id);
