-- Fiches RH des employés (conseillers, responsables dossier, admins).
-- Le solde de congé, les présences et la paie s'appuient sur cette fiche.

CREATE TABLE IF NOT EXISTS hr_employees (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  contract_type VARCHAR(10) NOT NULL DEFAULT 'CDI',
  hired_on DATE,
  contract_ends_on DATE,
  cin VARCHAR(20),
  cnss_number VARCHAR(30),
  rib VARCHAR(40),
  base_salary NUMERIC(12, 2),
  -- Jours de congé par mois pour un CDD ou un stage. CDI = 2 et CIVP = 1,5, calculés, pas stockés.
  leave_days_per_month NUMERIC(4, 2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day DATE NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
