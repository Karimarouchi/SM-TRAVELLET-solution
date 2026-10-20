-- Copie de la CIN et contrat de travail : un seul fichier de chaque sorte par employé.
ALTER TABLE hr_employee_documents
  ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'OTHER';

ALTER TABLE hr_employee_documents
  DROP CONSTRAINT IF EXISTS hr_employee_documents_kind_check;

ALTER TABLE hr_employee_documents
  ADD CONSTRAINT hr_employee_documents_kind_check CHECK (kind IN ('OTHER', 'CIN', 'CONTRACT'));

CREATE UNIQUE INDEX IF NOT EXISTS hr_employee_documents_identity_idx
  ON hr_employee_documents (user_id, kind)
  WHERE kind IN ('CIN', 'CONTRACT');
