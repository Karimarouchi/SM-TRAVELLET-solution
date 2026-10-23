-- Rythme d'une charge fixe : mois, trimestre ou semestre.
ALTER TABLE finance_charges
  ADD COLUMN IF NOT EXISTS rhythm VARCHAR(12) NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE finance_charges DROP CONSTRAINT IF EXISTS finance_charges_rhythm_check;
ALTER TABLE finance_charges
  ADD CONSTRAINT finance_charges_rhythm_check CHECK (rhythm IN ('MONTHLY', 'QUARTERLY', 'SEMESTER'));
