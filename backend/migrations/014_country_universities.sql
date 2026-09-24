-- Universités disponibles par pays, gérées par l'Admin (aucune liste en dur
-- côté frontend/backend) — alimentent le select "Université précise" de
-- l'onboarding selon le(s) pays choisi(s) par l'étudiant.
CREATE TABLE IF NOT EXISTS country_universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_id, name)
);

CREATE INDEX IF NOT EXISTS idx_country_universities_country ON country_universities (country_id);
CREATE INDEX IF NOT EXISTS idx_country_universities_active ON country_universities (active);
