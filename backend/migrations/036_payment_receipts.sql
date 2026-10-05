-- Numéro de reçu automatique par paiement (001-2026, 002-2026… la numérotation
-- repart à 001 chaque année). La colonne « reference » reste pour le numéro du
-- chèque ou le code du virement saisi à la main.

CREATE TABLE IF NOT EXISTS payment_receipt_counters (
  year SMALLINT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE student_payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(12);
ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS payment_receipt VARCHAR(12);

-- Paiements déjà enregistrés : numérotés dans l'ordre de leur saisie.
WITH numbered AS (
  SELECT id,
         EXTRACT(YEAR FROM created_at)::int AS yr,
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM created_at) ORDER BY created_at, id) AS n
  FROM student_payments
  WHERE receipt_number IS NULL
)
UPDATE student_payments p
SET receipt_number = LPAD(numbered.n::text, 3, '0') || '-' || numbered.yr
FROM numbered
WHERE p.id = numbered.id;

INSERT INTO payment_receipt_counters (year, last_number)
SELECT SPLIT_PART(receipt_number, '-', 2)::smallint, MAX(SPLIT_PART(receipt_number, '-', 1)::int)
FROM student_payments
WHERE receipt_number IS NOT NULL
GROUP BY SPLIT_PART(receipt_number, '-', 2)
ON CONFLICT (year) DO UPDATE SET last_number = GREATEST(payment_receipt_counters.last_number, EXCLUDED.last_number);

CREATE UNIQUE INDEX IF NOT EXISTS student_payments_receipt_key ON student_payments (receipt_number) WHERE receipt_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_payments_reference ON student_payments (method, reference) WHERE reference IS NOT NULL;
