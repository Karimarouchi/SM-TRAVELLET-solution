-- Certificat médical d'une journée d'absence. Accepté à temps, il retire la retenue.

CREATE TABLE IF NOT EXISTS hr_absence_certificates (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  stored_filename VARCHAR(180) NOT NULL,
  original_filename VARCHAR(200) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, day)
);
