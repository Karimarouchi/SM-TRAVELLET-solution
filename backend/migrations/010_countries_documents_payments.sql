-- Phase 1 : pays de destination (source de vérité), documents requis par pays,
-- documents étudiant, codes Sales, statut de paiement.
-- Ne supprime ni ne modifie aucune colonne existante (programmes.country,
-- student_profiles.preferred_countries/residence_country restent inchangées).

CREATE TABLE IF NOT EXISTS countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_active ON countries (active);

-- Seed : uniquement les pays déjà présents dans programmes.country (valeurs
-- réelles vérifiées en base, mapping 1:1 sans ambiguïté). Espagne/France
-- (présents dans student_profiles.preferred_countries mais sans programme
-- associé) sont volontairement exclus de ce seed (décision validée).
INSERT INTO countries (code, name, display_order)
SELECT 'IT', 'Italie', 1 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'IT');
INSERT INTO countries (code, name, display_order)
SELECT 'DE', 'Allemagne', 2 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'DE');
INSERT INTO countries (code, name, display_order)
SELECT 'HU', 'Hongrie', 3 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'HU');
INSERT INTO countries (code, name, display_order)
SELECT 'LT', 'Lituanie', 4 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'LT');
INSERT INTO countries (code, name, display_order)
SELECT 'PL', 'Pologne', 5 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'PL');
INSERT INTO countries (code, name, display_order)
SELECT 'SK', 'Slovaquie', 6 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'SK');
INSERT INTO countries (code, name, display_order)
SELECT 'RO', 'Roumanie', 7 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'RO');
INSERT INTO countries (code, name, display_order)
SELECT 'MT', 'Malte', 8 WHERE NOT EXISTS (SELECT 1 FROM countries WHERE code = 'MT');

-- programmes.country (texte libre) est CONSERVÉE. On ajoute uniquement
-- country_id en complément, backfillé par correspondance exacte de nom.
ALTER TABLE programmes ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_programmes_country_id ON programmes (country_id);

UPDATE programmes p
SET country_id = c.id
FROM countries c
WHERE p.country_id IS NULL AND p.country = c.name;

CREATE TABLE IF NOT EXISTS document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  required BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_id, name)
);

CREATE INDEX IF NOT EXISTS idx_document_requirements_country ON document_requirements (country_id);
CREATE INDEX IF NOT EXISTS idx_document_requirements_active ON document_requirements (active);

-- Aucun document seedé : la liste est entièrement administrable, pas de
-- hardcoding métier (pas d'INSERT ici, contrairement à countries qui ne fait
-- que reprendre des valeurs déjà existantes en base).

CREATE TABLE IF NOT EXISTS student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_requirement_id UUID NOT NULL REFERENCES document_requirements(id) ON DELETE CASCADE,
  file_url TEXT,
  original_filename VARCHAR(255),
  stored_filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_size INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CONSTRAINT student_documents_status_check CHECK (status IN ('PENDING', 'SUBMITTED', 'VALIDATED', 'REJECTED')),
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, document_requirement_id)
);

CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents (student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_status ON student_documents (status);

CREATE TABLE IF NOT EXISTS student_secondary_countries (
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, country_id)
);

CREATE INDEX IF NOT EXISTS idx_student_secondary_countries_country ON student_secondary_countries (country_id);

-- Structure prête, volontairement non remplie depuis preferred_countries
-- dans cette phase (règle métier "quel pays est principal" non validée).

CREATE TABLE IF NOT EXISTS sales_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  sales_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_by_student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sales_codes_used_consistency_check CHECK (
    (used = FALSE AND used_by_student_id IS NULL AND used_at IS NULL)
    OR
    (used = TRUE AND used_by_student_id IS NOT NULL AND used_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_sales_codes_sales ON sales_codes (sales_id);
CREATE INDEX IF NOT EXISTS idx_sales_codes_used ON sales_codes (used);

-- student_profiles : pays principal (FK, nullable) + statut de paiement.
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS main_country_id UUID REFERENCES countries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_student_profiles_main_country ON student_profiles (main_country_id);

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_payment_status_check'
  ) THEN
    ALTER TABLE student_profiles ADD CONSTRAINT student_profiles_payment_status_check
      CHECK (payment_status IN ('PAID', 'UNPAID'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_profiles_payment_status ON student_profiles (payment_status);
