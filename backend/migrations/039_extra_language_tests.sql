-- Tests de langue en allemand, italien et espagnol, en plus du français et de l'anglais.
-- Une seule colonne JSON : { "german": { "test": "TestDaF", "other": "" }, ... }
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS language_tests_extra JSONB NOT NULL DEFAULT '{}'::jsonb;
