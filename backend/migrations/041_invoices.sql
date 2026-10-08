-- Facturation : une facture regroupe un ou plusieurs paiements par chèque ou virement d'un étudiant
-- (même devise). Un paiement ne peut être facturé qu'une seule fois (UNIQUE sur payment_id) ; le
-- numéro de facture est séquentiel par année (FAC-2026-001) et affiche aussi les numéros de reçu.
CREATE TABLE IF NOT EXISTS invoice_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(20) NOT NULL UNIQUE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('TND', 'EUR')),
  total NUMERIC(12, 2) NOT NULL,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON invoices (student_id);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL UNIQUE REFERENCES student_payments(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines (invoice_id);
