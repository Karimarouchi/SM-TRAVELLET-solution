-- Commissions encore impayées déjà inscrites sur le PDF d'un mois.
-- Après ce PDF, elles ne reviennent plus sur la ligne hors fiche.
CREATE TABLE IF NOT EXISTS hr_payroll_reported_commissions (
  earning_id UUID PRIMARY KEY REFERENCES commission_earnings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_reported_commissions_month
  ON hr_payroll_reported_commissions (user_id, month);
