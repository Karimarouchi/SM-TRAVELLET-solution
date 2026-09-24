CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'STUDENT';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS sales_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(30),
  job_title VARCHAR(80),
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  assigned_sales_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone VARCHAR(30),
  nationality VARCHAR(80),
  residence_country VARCHAR(80),
  city VARCHAR(80),
  current_study_level VARCHAR(80),
  last_diploma VARCHAR(120),
  study_field VARCHAR(120),
  current_institution VARCHAR(160),
  diploma_year INTEGER,
  preferred_countries TEXT[],
  preferred_city VARCHAR(80),
  target_level VARCHAR(80),
  target_field VARCHAR(160),
  target_intake VARCHAR(40),
  target_university VARCHAR(160),
  annual_budget NUMERIC(12, 2),
  funding_mode VARCHAR(40),
  language_level VARCHAR(20),
  language_test VARCHAR(80),
  has_passport BOOLEAN,
  visa_already_requested BOOLEAN,
  available_documents TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_student_assigned_sales ON student_profiles (assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_student_onboarding ON student_profiles (onboarding_completed);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('STUDENT', 'SALES', 'ADMIN'));
  END IF;
END $$;
