-- Un seul rappel admin par employé et par date de fin de CDD.
CREATE TABLE IF NOT EXISTS hr_contract_reminders (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_ends_on DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, contract_ends_on)
);
