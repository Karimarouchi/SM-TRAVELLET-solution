-- Conversations WhatsApp : mise en sourdine et blocage.
--  - sourdine : la conversation reçoit toujours les messages mais ne compte plus dans les non lus
--    et ne déclenche plus ni notification ni alerte « en attente » ;
--  - blocage : les nouveaux messages du numéro sont ignorés (ni stockés, ni comptés, ni attribués)
--    et personne ne peut lui écrire depuis l'application.
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS muted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS muted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES users(id) ON DELETE SET NULL;
