-- Charges de l'agence : fixes (loyer, pourcentage du chiffre) ou variables (dépense datée).
CREATE TABLE IF NOT EXISTS finance_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('FIXED', 'VARIABLE')),
  label VARCHAR(160) NOT NULL,
  basis VARCHAR(10) NOT NULL CHECK (basis IN ('AMOUNT', 'PERCENT')),
  amount NUMERIC(12, 3) NOT NULL DEFAULT 0,
  percent NUMERIC(6, 3),
  starts_on DATE,
  ends_on DATE,
  spent_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
