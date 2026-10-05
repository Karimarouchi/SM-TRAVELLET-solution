-- Paiements : prix par pays en 2 tranches (1 = inscription / code, 2 = dépôt du
-- visa), plan de paiement par étudiant et pays, paiements enregistrés avec
-- historique. Les étudiants existants n'ont aucun plan : ils ne sont pas bloqués.

CREATE TABLE IF NOT EXISTS country_pricing (
  country_id UUID PRIMARY KEY REFERENCES countries(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL DEFAULT 'TND' CHECK (currency IN ('TND', 'EUR')),
  tranche1_amount NUMERIC(12, 2) NOT NULL CHECK (tranche1_amount >= 0),
  tranche2_amount NUMERIC(12, 2) NOT NULL CHECK (tranche2_amount >= 0),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tarif figé à la création du plan : un changement de prix ultérieur ne touche
-- pas les étudiants déjà engagés.
CREATE TABLE IF NOT EXISTS payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES countries(id),
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('TND', 'EUR')),
  tranche1_due NUMERIC(12, 2) NOT NULL,
  tranche2_due NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, country_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_plans_country ON payment_plans (country_id);

CREATE TABLE IF NOT EXISTS student_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tranche SMALLINT NOT NULL CHECK (tranche IN (1, 2)),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  method VARCHAR(10) NOT NULL CHECK (method IN ('CASH', 'TRANSFER', 'CARD', 'CHEQUE')),
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  reference VARCHAR(120),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_by_role VARCHAR(10) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancel_reason VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_payments_plan ON student_payments (plan_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_student ON student_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_paid_at ON student_payments (paid_at);

-- Tranche 1 confirmée par le conseiller à la création du code (le compte
-- n'existe pas encore) : appliquée à l'inscription de l'étudiant.
ALTER TABLE sales_codes
  ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS payment_tranche1 NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_tranche2 NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS payment_paid_at DATE;
