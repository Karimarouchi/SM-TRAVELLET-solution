-- Répartition automatique par pourcentage (ex. 40 % / 40 % / 20 %).
-- Une part par conseiller ; des compteurs de « nouveaux arrivants » par flux
-- (contacts WhatsApp / étudiants sans conseiller), remis à zéro à chaque
-- changement des pourcentages.
CREATE TABLE IF NOT EXISTS auto_assign_shares (
  sales_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auto_assign_counts (
  sales_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('students', 'whatsapp')),
  assigned_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sales_id, scope)
);

INSERT INTO app_settings (key, value, updated_at) VALUES ('auto_assign_mode', 'balanced', NOW())
ON CONFLICT (key) DO NOTHING;
