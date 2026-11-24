-- Timbre fiscal des factures (en dinars, hors TVA) : figé sur chaque facture à son émission, comme le taux de TVA.
-- Il fait partie du total TTC : hors taxe + TVA + timbre = somme payée. Il ne s'applique qu'aux factures en dinars.
-- Les factures déjà émises prennent le timbre courant de 1 DT (même total TTC, seule la présentation change).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stamp_duty NUMERIC(8, 3);
UPDATE invoices SET stamp_duty = CASE WHEN currency = 'TND' THEN 1 ELSE 0 END WHERE stamp_duty IS NULL;
