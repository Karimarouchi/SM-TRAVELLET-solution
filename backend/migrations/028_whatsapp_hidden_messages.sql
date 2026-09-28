-- Masquer un message WhatsApp dans l'application (l'API de Meta ne permet pas
-- de le supprimer chez l'étudiant). Le texte est conservé pour la traçabilité,
-- mais n'est plus renvoyé à l'interface.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES users(id) ON DELETE SET NULL;
