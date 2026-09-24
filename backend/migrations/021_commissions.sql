-- Commissions Sales/RDV : montant fixe en dinars, configuré par l'admin par
-- pays + rôle + étape du parcours. Chaque gain est enregistré une seule fois
-- par (utilisateur, étudiant, pays, étape) — une nouvelle tentative sur le
-- même pays ne repaie jamais la même étape deux fois.
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,
  stage VARCHAR(30) NOT NULL,
  amount_dinar NUMERIC(10,2) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commission_rules_role_check CHECK (role IN ('SALES', 'RDV')),
  CONSTRAINT commission_rules_stage_check CHECK (stage IN (
    'CODE_CLAIMED', 'DOCUMENTS_VALIDATED', 'APPLIED', 'ACCEPTED', 'VISA_SUBMITTED', 'VISA_ACCEPTED'
  )),
  CONSTRAINT commission_rules_amount_check CHECK (amount_dinar >= 0),
  UNIQUE (country_id, role, stage)
);

CREATE TABLE IF NOT EXISTS commission_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES commission_rules(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES university_applications(id) ON DELETE SET NULL,
  country_id UUID NOT NULL REFERENCES countries(id),
  role VARCHAR(10) NOT NULL,
  stage VARCHAR(30) NOT NULL,
  amount_dinar NUMERIC(10,2) NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, student_id, country_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_commission_earnings_user ON commission_earnings (user_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_student ON commission_earnings (student_id);
