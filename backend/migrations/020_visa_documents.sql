-- Documents spécifiques au dossier VISA, par destination : même table que
-- les documents du dossier universitaire (mêmes mécaniques d'upload / fusion
-- / validation), distingués par une catégorie.
ALTER TABLE document_requirements ADD COLUMN IF NOT EXISTS category VARCHAR(10) NOT NULL DEFAULT 'DOSSIER';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_requirements_category_check'
  ) THEN
    ALTER TABLE document_requirements ADD CONSTRAINT document_requirements_category_check
      CHECK (category IN ('DOSSIER', 'VISA'));
  END IF;
END $$;

-- Nouvelle permission dédiée : gérer les documents visa sans donner la main
-- sur les pays / universités / documents du dossier universitaire.
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_check
  CHECK (permission IN ('MANAGE_PROGRAMMES', 'MANAGE_COUNTRIES', 'MANAGE_AVIS', 'MANAGE_VISA_DOCUMENTS'));
