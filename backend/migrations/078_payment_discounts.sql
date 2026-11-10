-- Remises sur les tranches de paiement (accordées par le conseiller commercial ou l'admin).
--
-- tranche1_due / tranche2_due restent LE MONTANT À PAYER (net de la remise) : tout le code qui les
-- lit (reste dû, blocages dépôt, finance, statistiques) fonctionne donc sans changement.
-- tranche1_base / tranche2_base gardent le prix catalogue, pour afficher et recalculer la remise.
ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS tranche1_base NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS tranche2_base NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS tranche1_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tranche2_discount NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE payment_plans SET tranche1_base = tranche1_due WHERE tranche1_base IS NULL;
UPDATE payment_plans SET tranche2_base = tranche2_due WHERE tranche2_base IS NULL;

ALTER TABLE payment_plans
  ALTER COLUMN tranche1_base SET NOT NULL,
  ALTER COLUMN tranche2_base SET NOT NULL;

-- Historique : qui a accordé quoi, quand, pourquoi. Une seule remise active par tranche ;
-- en accorder une nouvelle annule la précédente (elle reste dans l'historique).
CREATE TABLE IF NOT EXISTS payment_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  tranche SMALLINT NOT NULL CHECK (tranche IN (1, 2)),
  kind VARCHAR(8) NOT NULL CHECK (kind IN ('PERCENT', 'AMOUNT')),
  value NUMERIC(12, 2) NOT NULL CHECK (value > 0),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(300),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_role VARCHAR(10) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED')),
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancel_reason VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_discounts_plan ON payment_discounts (plan_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_discounts_active ON payment_discounts (plan_id, tranche) WHERE status = 'ACTIVE';

-- Remise accordée sur la tranche 1 à la création du code (appliquée quand l'étudiant s'inscrit).
ALTER TABLE sales_codes
  ADD COLUMN IF NOT EXISTS payment_discount_kind VARCHAR(8),
  ADD COLUMN IF NOT EXISTS payment_discount_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_discount_reason VARCHAR(300),
  ADD COLUMN IF NOT EXISTS payment_discount_amount NUMERIC(12, 2);
