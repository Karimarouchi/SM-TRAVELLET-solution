-- Message de bienvenue WhatsApp : envoyé une seule fois au tout premier message d'un nouveau client.
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ;

-- Les contacts déjà connus ne le reçoivent jamais.
UPDATE whatsapp_contacts SET welcome_sent_at = COALESCE(created_at, NOW()) WHERE welcome_sent_at IS NULL;
