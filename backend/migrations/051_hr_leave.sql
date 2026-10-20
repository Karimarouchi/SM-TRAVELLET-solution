-- Demandes de congé et décision de fin d'année (report ou paiement).

CREATE TABLE IF NOT EXISTS hr_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_on DATE NOT NULL,
  end_on DATE NOT NULL,
  days NUMERIC(6, 2) NOT NULL,
  covers_absence BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  decided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_on >= start_on),
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS hr_leave_requests_user_idx ON hr_leave_requests (user_id, start_on);

CREATE TABLE IF NOT EXISTS hr_leave_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  action VARCHAR(6) NOT NULL CHECK (action IN ('CARRY', 'PAY')),
  days NUMERIC(6, 2) NOT NULL,
  amount NUMERIC(12, 3),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year)
);
