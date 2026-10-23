-- Paiement réel d'un salaire : un enregistrement par employé et par mois.
CREATE TABLE IF NOT EXISTS hr_salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  amount NUMERIC(12, 3) NOT NULL,
  paid_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)
);
