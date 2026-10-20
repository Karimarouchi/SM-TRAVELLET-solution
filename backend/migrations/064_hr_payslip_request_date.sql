-- Date à laquelle l'admin promet la fiche. La demande reste ouverte jusqu'à cette date.
ALTER TABLE hr_document_requests
  ADD COLUMN IF NOT EXISTS ready_on DATE,
  ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
