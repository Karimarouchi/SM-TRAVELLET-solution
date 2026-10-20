-- Une absence ne compte qu'après validation. Un jour férié peut être impayé.

ALTER TABLE hr_attendance_overrides
  ADD COLUMN IF NOT EXISTS confirmed_absent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE hr_holidays
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE hr_payslips
  ADD COLUMN IF NOT EXISTS unpaid_holiday_deduction NUMERIC(12, 3) NOT NULL DEFAULT 0;
