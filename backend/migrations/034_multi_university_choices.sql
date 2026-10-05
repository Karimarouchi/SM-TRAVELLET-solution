-- Candidatures multiples : un étudiant peut viser jusqu'à 3 candidatures actives
-- en même temps (universités différentes, ou la même université dans plusieurs
-- filières). Chaque vœu est une ligne de student_university_choices ; la
-- candidature (university_applications) naît de ce vœu quand les documents
-- communs du pays ET ceux de l'université sont validés.

-- Origine d'une université : ADMIN = conventionnée (définie par l'admin),
-- STUDENT = ajoutée par un étudiant ou un conseiller, hors conventions. Elle est
-- conservée dans la liste du pays : un futur étudiant qui la saisit retrouve
-- ses documents déjà définis.
ALTER TABLE country_universities
  ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'ADMIN';
ALTER TABLE country_universities DROP CONSTRAINT IF EXISTS country_universities_source_check;
ALTER TABLE country_universities
  ADD CONSTRAINT country_universities_source_check CHECK (source IN ('ADMIN', 'STUDENT'));

-- Documents spécifiques à une université (en plus des documents communs du
-- pays). university_id NULL = document commun du pays.
ALTER TABLE document_requirements
  ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES country_universities(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_document_requirements_university ON document_requirements (university_id);

-- Le nom d'un document n'est unique qu'à l'intérieur de son périmètre (pays
-- entier, ou une université précise).
ALTER TABLE document_requirements DROP CONSTRAINT IF EXISTS document_requirements_country_id_name_key;
DROP INDEX IF EXISTS document_requirements_country_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS document_requirements_scope_name_key
  ON document_requirements (country_id, COALESCE(university_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

CREATE TABLE IF NOT EXISTS student_university_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES countries(id),
  university_id UUID NOT NULL REFERENCES country_universities(id),
  field_of_study VARCHAR(120) NOT NULL DEFAULT '',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_by_role VARCHAR(10) NOT NULL DEFAULT 'STUDENT',
  withdrawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_choices_student ON student_university_choices (student_id);
CREATE INDEX IF NOT EXISTS idx_student_choices_university ON student_university_choices (university_id);
-- Un même vœu (université + filière) ne peut exister qu'une fois en cours.
CREATE UNIQUE INDEX IF NOT EXISTS student_choices_active_unique
  ON student_university_choices (student_id, university_id, LOWER(field_of_study)) WHERE withdrawn_at IS NULL;

ALTER TABLE university_applications
  ADD COLUMN IF NOT EXISTS choice_id UUID REFERENCES student_university_choices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_of_study VARCHAR(120) NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_university_applications_choice ON university_applications (choice_id);

-- ── Reprise des étudiants existants (leurs données ne sont pas modifiées) ──
-- 1) Une candidature en cours devient un vœu.
INSERT INTO student_university_choices (student_id, country_id, university_id, field_of_study, added_by_role)
SELECT DISTINCT ON (ua.student_id, ua.university_id) ua.student_id, ua.country_id, ua.university_id, COALESCE(sp.target_field, ''), 'SYSTEM'
FROM university_applications ua
LEFT JOIN student_profiles sp ON sp.user_id = ua.student_id
WHERE ua.status NOT IN ('REJECTED', 'CLOSED')
  AND NOT EXISTS (SELECT 1 FROM student_university_choices c WHERE c.student_id = ua.student_id AND c.university_id = ua.university_id AND c.withdrawn_at IS NULL)
ORDER BY ua.student_id, ua.university_id, ua.created_at DESC;

-- 2) L'université visée dans la fiche (onboarding) devient un vœu, dans le pays
--    préféré où elle existe.
INSERT INTO student_university_choices (student_id, country_id, university_id, field_of_study, added_by_role)
SELECT sp.user_id, cu.country_id, cu.id, COALESCE(sp.target_field, ''), 'SYSTEM'
FROM student_profiles sp
JOIN countries c ON LOWER(c.name) IN (SELECT LOWER(x) FROM unnest(COALESCE(sp.preferred_countries, ARRAY[]::text[])) AS x)
JOIN country_universities cu ON cu.country_id = c.id AND LOWER(cu.name) = LOWER(sp.target_university)
WHERE COALESCE(sp.target_university, '') <> ''
  AND NOT EXISTS (SELECT 1 FROM student_university_choices ch WHERE ch.student_id = sp.user_id AND ch.university_id = cu.id AND ch.withdrawn_at IS NULL);

-- 3) Les candidatures existantes pointent vers leur vœu.
UPDATE university_applications ua
SET choice_id = ch.id, field_of_study = ch.field_of_study
FROM student_university_choices ch
WHERE ua.choice_id IS NULL AND ch.student_id = ua.student_id AND ch.university_id = ua.university_id AND ch.withdrawn_at IS NULL;

-- 4) Les universités saisies librement jusqu'ici (créées inactives) sont hors conventions.
UPDATE country_universities SET source = 'STUDENT' WHERE active = FALSE;
