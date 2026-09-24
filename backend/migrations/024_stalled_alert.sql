ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS stalled_alert_last_sent_at TIMESTAMPTZ;
