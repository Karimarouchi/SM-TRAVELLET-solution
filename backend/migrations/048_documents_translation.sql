-- Étape « Documents en traduction » : après validation des documents d'études, la
-- candidature reste chez le conseiller tant que la traduction n'est pas terminée ;
-- le Responsable Dossier n'est attribué (« À déposer ») qu'une fois translation_done_at renseigné.
ALTER TABLE university_applications
  ADD COLUMN IF NOT EXISTS translation_done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS translation_done_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Les candidatures existantes ne repassent pas par la traduction.
UPDATE university_applications SET translation_done_at = created_at WHERE translation_done_at IS NULL;
