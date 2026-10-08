-- Numéro WhatsApp Business auquel le client a écrit : les réponses repartent de CE numéro, pour
-- apparaître dans la même conversation sur le téléphone du client.
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS wa_phone_number_id VARCHAR(40),
  ADD COLUMN IF NOT EXISTS wa_display_phone VARCHAR(30);
