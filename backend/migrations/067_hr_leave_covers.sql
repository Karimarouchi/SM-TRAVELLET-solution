-- Remplacement pendant un congé accepté : le portefeuille du conseiller (SALES) ou du Responsable
-- Dossier (RDV) absent est confié à un ou plusieurs remplaçants, par pourcentage, du premier au
-- dernier jour du congé. Rien n'est déplacé : l'absent reste propriétaire (commissions, dossiers),
-- le remplaçant traite. Le lendemain de la fin, tout revient à l'absent sans aucune action.

CREATE TABLE IF NOT EXISTS hr_leave_covers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_id UUID NOT NULL REFERENCES hr_leave_requests(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope VARCHAR(5) NOT NULL CHECK (scope IN ('SALES', 'RDV')),
  substitute_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 100),
  -- Tranche [bucket_from, bucket_to) sur 0..99 : un étudiant tombe toujours dans la même tranche.
  bucket_from INTEGER NOT NULL CHECK (bucket_from BETWEEN 0 AND 99),
  bucket_to INTEGER NOT NULL CHECK (bucket_to BETWEEN 1 AND 100),
  start_on DATE NOT NULL,
  end_on DATE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (bucket_to > bucket_from),
  CHECK (end_on >= start_on),
  CHECK (substitute_id <> owner_id),
  UNIQUE (leave_id, scope, substitute_id)
);

CREATE INDEX IF NOT EXISTS hr_leave_covers_owner_idx ON hr_leave_covers (owner_id, scope, start_on, end_on);
CREATE INDEX IF NOT EXISTS hr_leave_covers_substitute_idx ON hr_leave_covers (substitute_id, start_on, end_on);

-- Étudiant (ou contact WhatsApp sans compte) confié à la main à un remplaçant précis.
CREATE TABLE IF NOT EXISTS hr_leave_cover_overrides (
  leave_id UUID NOT NULL REFERENCES hr_leave_requests(id) ON DELETE CASCADE,
  scope VARCHAR(5) NOT NULL CHECK (scope IN ('SALES', 'RDV')),
  item_id UUID NOT NULL,
  substitute_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (leave_id, scope, item_id)
);

-- Résumé envoyé à l'absent le jour de son retour (une seule fois).
ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS cover_summary_sent_at TIMESTAMPTZ;

-- Message WhatsApp envoyé par un remplaçant (au nom de l'absent) : trace de l'auteur réel.
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS cover_leave_id UUID REFERENCES hr_leave_requests(id) ON DELETE SET NULL;

-- Tranche 0..99 d'un élément, identique au calcul fait côté serveur Node (md5, 7 premiers chiffres hexa).
CREATE OR REPLACE FUNCTION leave_bucket(p_item UUID) RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT (('x' || substr(md5(p_item::text), 1, 7))::bit(28)::int % 100)
$$;

-- Qui traite aujourd'hui (heure de Tunis) l'élément p_item du portefeuille de p_owner ?
-- Le remplaçant choisi à la main, sinon celui de sa tranche, sinon un autre remplaçant actif,
-- sinon le propriétaire lui-même (pas de congé en cours).
CREATE OR REPLACE FUNCTION leave_handler(p_owner UUID, p_item UUID, p_scope TEXT) RETURNS UUID
LANGUAGE sql STABLE AS $$
  WITH covers AS (
    SELECT c.leave_id, c.substitute_id, c.bucket_from, c.bucket_to
    FROM hr_leave_covers c
    JOIN users s ON s.id = c.substitute_id AND s.is_active = TRUE
    WHERE p_owner IS NOT NULL
      AND c.owner_id = p_owner
      AND c.scope = p_scope
      AND (NOW() AT TIME ZONE 'Africa/Tunis')::date BETWEEN c.start_on AND c.end_on
  )
  SELECT COALESCE(
    (SELECT o.substitute_id FROM hr_leave_cover_overrides o
       JOIN covers c ON c.leave_id = o.leave_id AND c.substitute_id = o.substitute_id
      WHERE p_item IS NOT NULL AND o.scope = p_scope AND o.item_id = p_item LIMIT 1),
    (SELECT c.substitute_id FROM covers c
      WHERE p_item IS NOT NULL AND leave_bucket(p_item) >= c.bucket_from AND leave_bucket(p_item) < c.bucket_to LIMIT 1),
    (SELECT c.substitute_id FROM covers c ORDER BY c.bucket_from LIMIT 1),
    p_owner
  )
$$;
