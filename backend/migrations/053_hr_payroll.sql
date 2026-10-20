-- Fiche de paie, primes, avances et documents d'employé.
-- La signature et le cachet sont des fichiers dont le nom est dans app_settings.

CREATE TABLE IF NOT EXISTS hr_payroll_adjustments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  bonus NUMERIC(12, 3) NOT NULL DEFAULT 0,
  advance NUMERIC(12, 3) NOT NULL DEFAULT 0,
  note TEXT,
  PRIMARY KEY (user_id, month)
);

CREATE TABLE IF NOT EXISTS hr_payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  base_salary NUMERIC(12, 3) NOT NULL DEFAULT 0,
  commissions NUMERIC(12, 3) NOT NULL DEFAULT 0,
  bonus NUMERIC(12, 3) NOT NULL DEFAULT 0,
  paid_leave NUMERIC(12, 3) NOT NULL DEFAULT 0,
  absence_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0,
  lateness_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0,
  presence_adjustment NUMERIC(12, 3),
  advance NUMERIC(12, 3) NOT NULL DEFAULT 0,
  net NUMERIC(12, 3) NOT NULL,
  note TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS hr_employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  stored_filename VARCHAR(180) NOT NULL,
  original_filename VARCHAR(200) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_employee_documents_user_idx ON hr_employee_documents (user_id, created_at DESC);
