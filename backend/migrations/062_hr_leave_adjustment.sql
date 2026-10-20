-- Correction manuelle du solde de congé d'une année. Les jours acceptés restent retirés.
CREATE TABLE IF NOT EXISTS hr_leave_adjustments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  days NUMERIC(8,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, year)
);
