-- Pointage des connexions, corrections d'une journée et montant du mois saisi par l'admin.

CREATE TABLE IF NOT EXISTS hr_presence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(8) NOT NULL CHECK (kind IN ('LOGIN', 'LOGOUT')),
  at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_presence_events_user_at ON hr_presence_events (user_id, at);

CREATE TABLE IF NOT EXISTS hr_attendance_overrides (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  waived BOOLEAN NOT NULL DEFAULT FALSE,
  late_minutes INTEGER,
  early_minutes INTEGER,
  note TEXT,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS hr_attendance_amounts (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC(12, 3),
  PRIMARY KEY (user_id, month)
);
