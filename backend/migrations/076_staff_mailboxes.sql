-- Boîte mail personnelle de chaque employé (Hostinger). Le mot de passe est chiffré, jamais renvoyé par l'API.
CREATE TABLE IF NOT EXISTS staff_mailboxes (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_enc TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
