ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS language_test_french VARCHAR(80),
  ADD COLUMN IF NOT EXISTS language_test_english VARCHAR(80),
  ADD COLUMN IF NOT EXISTS language_test_french_other VARCHAR(120),
  ADD COLUMN IF NOT EXISTS language_test_english_other VARCHAR(120);

ALTER TABLE student_profiles
  ALTER COLUMN language_test TYPE VARCHAR(240);
