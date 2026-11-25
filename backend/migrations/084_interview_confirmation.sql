-- Le conseiller (sales) confirme le RDV qui prendra le dossier avant que l'entretien lui soit transmis.
-- Les entretiens déjà créés (RDV déjà notifié) sont considérés comme confirmés.
ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE student_interviews ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id);
UPDATE student_interviews SET confirmed_at = created_at WHERE confirmed_at IS NULL AND rdv_id IS NOT NULL;
