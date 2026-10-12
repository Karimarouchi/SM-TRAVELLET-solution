-- E-mails envoyés à un étudiant depuis la page Mail : conservés dans son espace (preuve de réception) et dans son profil.
CREATE TABLE IF NOT EXISTS student_mails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(300) NOT NULL,
  body TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  message_id VARCHAR(300),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_student_mails_student ON student_mails (student_id, sent_at DESC);
