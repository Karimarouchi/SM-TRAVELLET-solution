-- Niveaux (A1 à C2) dans trois langues supplémentaires. Facultatifs : une valeur
-- vide signifie « aucun niveau » (l'étudiant ne parle pas la langue).
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS language_level_german VARCHAR(10),
  ADD COLUMN IF NOT EXISTS language_level_italian VARCHAR(10),
  ADD COLUMN IF NOT EXISTS language_level_spanish VARCHAR(10);
