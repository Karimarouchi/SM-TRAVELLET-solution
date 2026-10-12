-- WhatsApp : fichiers envoyés (images, documents) et réponse automatique des jours non travaillés.
ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_auto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS media_path VARCHAR(255),
  ADD COLUMN IF NOT EXISTS media_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS media_mime VARCHAR(120);

-- Dernière réponse automatique envoyée à ce contact : une seule par période de fermeture.
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS last_auto_reply_at TIMESTAMPTZ;
