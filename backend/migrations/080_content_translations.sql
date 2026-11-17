-- Programmes et avis du site vitrine : traductions saisies par l'administrateur (anglais, arabe).
-- Le français reste dans les colonnes existantes ; translations = { "en": {...}, "ar": {...} }.
-- Un champ sans traduction retombe sur le français côté vitrine.
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE avis ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;
