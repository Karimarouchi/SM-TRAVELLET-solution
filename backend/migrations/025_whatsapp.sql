CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  profile_name VARCHAR(120),
  student_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_sales_id UUID REFERENCES users(id) ON DELETE SET NULL,
  last_inbound_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_last_message ON whatsapp_contacts (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_sales ON whatsapp_contacts (assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_student ON whatsapp_contacts (student_id);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  wa_message_id TEXT UNIQUE,
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
  type VARCHAR(20) NOT NULL DEFAULT 'text',
  body TEXT,
  status VARCHAR(12) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'sent', 'delivered', 'read', 'failed')),
  error TEXT,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact ON whatsapp_messages (contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_reads (
  contact_id UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contact_id, user_id)
);
