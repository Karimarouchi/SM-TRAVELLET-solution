-- Versement des commissions : chaque versement regroupe les commissions payées à un employé
-- (conseiller ou Responsable Dossier). Une commission est « payée » quand elle est rattachée à
-- un versement (payout_id) ; sinon elle est « à verser ». L'historique des versements est conservé.
CREATE TABLE IF NOT EXISTS commission_payout_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number VARCHAR(20) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_dinar NUMERIC(12, 2) NOT NULL,
  earnings_count INTEGER NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_user ON commission_payouts (user_id, paid_at DESC);

ALTER TABLE commission_earnings
  ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES commission_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_commission_earnings_payout ON commission_earnings (payout_id);
