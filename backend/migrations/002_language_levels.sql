ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS language_level_french VARCHAR(10),
  ADD COLUMN IF NOT EXISTS language_level_english VARCHAR(10);

ALTER TABLE student_profiles
  ALTER COLUMN language_level TYPE VARCHAR(40);
