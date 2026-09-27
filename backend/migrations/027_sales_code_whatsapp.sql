-- Code conseiller envoyé à un contact WhatsApp : quand l'étudiant s'inscrit
-- avec ce code, sa conversation WhatsApp est automatiquement liée à son
-- compte.
ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS whatsapp_contact_id UUID REFERENCES whatsapp_contacts(id) ON DELETE SET NULL;
