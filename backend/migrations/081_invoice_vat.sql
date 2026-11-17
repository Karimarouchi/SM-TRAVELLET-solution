-- Factures avec TVA : le taux appliqué est figé sur chaque facture au moment de son émission (modifier le
-- taux dans Paramètres ne touche que les factures suivantes). Le montant payé reste le montant TTC.
-- Les factures déjà émises (sans TVA affichée) prennent le taux courant de 19 % : même total TTC,
-- seule la présentation change (HT, TVA, TTC).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5, 2);
UPDATE invoices SET vat_rate = 19 WHERE vat_rate IS NULL;
