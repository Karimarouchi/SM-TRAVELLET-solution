-- Commissions déjà payées qu'on choisit d'ajouter à une fiche de paie.
CREATE TABLE IF NOT EXISTS hr_payroll_included_commissions (
  earning_id UUID PRIMARY KEY REFERENCES commission_earnings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_included_commissions_month
  ON hr_payroll_included_commissions (user_id, month);

ALTER TABLE hr_payslips
  ADD COLUMN IF NOT EXISTS included_commissions NUMERIC(12, 3) NOT NULL DEFAULT 0;
