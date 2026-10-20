-- Primes et avances en plusieurs lignes, solde d'avances, rappel de certificat.

CREATE TABLE IF NOT EXISTS hr_payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('BONUS', 'ADVANCE', 'RECOVERY')),
  label VARCHAR(160) NOT NULL,
  amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hr_payroll_entries_user_month ON hr_payroll_entries (user_id, month);

INSERT INTO hr_payroll_entries (user_id, month, kind, label, amount)
SELECT user_id, month, 'BONUS', 'Prime', bonus
FROM hr_payroll_adjustments
WHERE bonus > 0
  AND NOT EXISTS (
    SELECT 1 FROM hr_payroll_entries e
    WHERE e.user_id = hr_payroll_adjustments.user_id AND e.month = hr_payroll_adjustments.month AND e.kind = 'BONUS'
  );

INSERT INTO hr_payroll_entries (user_id, month, kind, label, amount)
SELECT user_id, month, 'RECOVERY', 'Retenue sur avance', advance
FROM hr_payroll_adjustments
WHERE advance > 0
  AND NOT EXISTS (
    SELECT 1 FROM hr_payroll_entries e
    WHERE e.user_id = hr_payroll_adjustments.user_id AND e.month = hr_payroll_adjustments.month AND e.kind = 'RECOVERY'
  );

ALTER TABLE hr_payslips ADD COLUMN IF NOT EXISTS advance_balance NUMERIC(12, 3);

CREATE TABLE IF NOT EXISTS hr_absence_reminders (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);
