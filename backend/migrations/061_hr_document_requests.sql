-- Demande d'attestation de travail ou de fiche de paie. Le PDF n'est disponible qu'après validation.
CREATE TABLE IF NOT EXISTS hr_document_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('WORK', 'PAYSLIP')),
  month DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES users(id),
  CHECK ((kind = 'WORK' AND month IS NULL) OR (kind = 'PAYSLIP' AND month IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_document_requests_work_pending
  ON hr_document_requests (user_id) WHERE kind = 'WORK' AND status = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS hr_document_requests_payslip_pending
  ON hr_document_requests (user_id, month) WHERE kind = 'PAYSLIP' AND status = 'PENDING';
