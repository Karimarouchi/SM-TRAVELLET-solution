-- Un retard détecté ne compte dans la paie qu'après validation de l'admin.

ALTER TABLE hr_attendance_overrides
  ADD COLUMN IF NOT EXISTS confirmed_late BOOLEAN NOT NULL DEFAULT FALSE;
