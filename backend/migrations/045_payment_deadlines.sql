-- Paiement partiel d'une tranche : date limite promise à l'étudiant pour payer le reste,
-- et montant réellement encaissé à la création du code d'inscription.
ALTER TABLE payment_plans
  ADD COLUMN IF NOT EXISTS tranche1_deadline DATE,
  ADD COLUMN IF NOT EXISTS tranche2_deadline DATE;

ALTER TABLE sales_codes
  ADD COLUMN IF NOT EXISTS payment_paid_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_deadline DATE;
