-- Quand l'admin répond dans la conversation d'un conseiller, le message est
-- présenté au nom de ce conseiller. L'auteur réel (sent_by) est conservé pour
-- la traçabilité et les statistiques ; sent_as_id est l'auteur AFFICHÉ.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS sent_as_id UUID REFERENCES users(id) ON DELETE SET NULL;
