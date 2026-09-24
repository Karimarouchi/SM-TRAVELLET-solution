-- Type de fichier accepté pour chaque document requis, choisi par l'Admin au
-- moment de créer/modifier le document (pas de valeur figée dans le code).
ALTER TABLE document_requirements ADD COLUMN IF NOT EXISTS accepted_file_types VARCHAR(20) NOT NULL DEFAULT 'IMAGE_PDF';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_requirements_accepted_file_types_check'
  ) THEN
    ALTER TABLE document_requirements ADD CONSTRAINT document_requirements_accepted_file_types_check
      CHECK (accepted_file_types IN ('IMAGE', 'PDF', 'IMAGE_PDF'));
  END IF;
END $$;
