-- Tarif par niveau de programme (Licence, Master...). Un pays sans niveau
-- garde son tarif unique dans country_pricing. Les plans déjà créés ne sont
-- pas réécrits : l'étudiant engagé conserve son prix.

CREATE TABLE IF NOT EXISTS level_pricing (
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  level_id TEXT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'TND' CHECK (currency IN ('TND', 'EUR')),
  tranche1_amount NUMERIC(12, 2) NOT NULL CHECK (tranche1_amount >= 0),
  tranche2_amount NUMERIC(12, 2) NOT NULL CHECK (tranche2_amount >= 0),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country_id, level_id)
);

ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS level_id TEXT;
ALTER TABLE payment_plans ADD COLUMN IF NOT EXISTS level_name TEXT;

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS target_level_id TEXT;

ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS prefill_level_id TEXT;

-- Identifiant stable sur chaque niveau déjà saisi, et copie du tarif du pays
-- sur chacun de ces niveaux pour que l'admin n'ait qu'à corriger les écarts.
DO $$
DECLARE
  prog RECORD;
  elem JSONB;
  new_details JSONB;
  i INT;
  n INT;
  lvl_id TEXT;
BEGIN
  FOR prog IN SELECT id, country_id, details FROM programmes LOOP
    IF prog.details IS NULL OR jsonb_typeof(prog.details) <> 'array' THEN
      CONTINUE;
    END IF;
    new_details := '[]'::jsonb;
    n := jsonb_array_length(prog.details);
    FOR i IN 0..n - 1 LOOP
      elem := prog.details -> i;
      lvl_id := NULLIF(BTRIM(elem->>'id'), '');
      IF lvl_id IS NULL THEN
        lvl_id := gen_random_uuid()::text;
        elem := jsonb_set(elem, '{id}', to_jsonb(lvl_id), true);
      END IF;
      new_details := new_details || jsonb_build_array(elem);
      IF prog.country_id IS NOT NULL AND NULLIF(BTRIM(elem->>'name'), '') IS NOT NULL THEN
        INSERT INTO level_pricing (country_id, level_id, currency, tranche1_amount, tranche2_amount)
        SELECT prog.country_id, lvl_id, cp.currency, cp.tranche1_amount, cp.tranche2_amount
        FROM country_pricing cp
        WHERE cp.country_id = prog.country_id
        ON CONFLICT (country_id, level_id) DO NOTHING;
      END IF;
    END LOOP;
    UPDATE programmes SET details = new_details, updated_at = NOW() WHERE id = prog.id;
  END LOOP;
END $$;
