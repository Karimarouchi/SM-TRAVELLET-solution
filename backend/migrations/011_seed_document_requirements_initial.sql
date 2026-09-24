-- Seed INITIAL des documents requis (données métier fournies par le client).
-- Ceci est une INITIALISATION DE DONNÉES, pas de la configuration applicative :
-- après cette migration, ces documents sont 100% administrables depuis
-- /#/admin/programmes (onglet Documents) via l'API CRUD déjà en place.
--
-- Idempotent : chaque INSERT est gardé par WHERE NOT EXISTS sur (country_id, name).
-- Cette migration ne sera de toute façon exécutée qu'une seule fois grâce au
-- tracking schema_migrations (voir backend/src/db/migrate.js) : un redémarrage
-- du backend ne la rejoue jamais et n'écrase donc aucune modification Admin
-- (renommage, désactivation, suppression) faite après cette initialisation.

-- ========================= ITALIE =========================
INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Copie scannée du passeport', NULL, true, 1
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Copie scannée du passeport');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme original (ou copie conforme)', 'Bac / Licence / Master', true, 2
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme traduit en italien + apostillé', NULL, true, 3
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme traduit en italien + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes original (ou copie conforme)', 'Bac / Licence / Master', true, 4
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes traduit en italien + apostillé', NULL, true, 5
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes traduit en italien + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Certificat de langue', 'Italien (B1/B2) ou Anglais (B2)', true, 6
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Certificat de langue');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Curriculum Vitae (CV)', 'En anglais', true, 7
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Curriculum Vitae (CV)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Photo d''identité récente', 'Format 35 × 45 mm', true, 8
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Photo d''identité récente');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Formulaire d''inscription', NULL, true, 9
FROM countries c WHERE c.name = 'Italie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Formulaire d''inscription');

-- ========================= ALLEMAGNE =========================
INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Copie scannée du passeport', NULL, true, 1
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Copie scannée du passeport');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme original (ou copie conforme)', 'Bac / Licence / Master', true, 2
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme traduit en allemand ou en anglais + apostillé', NULL, true, 3
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme traduit en allemand ou en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes original (ou copie conforme)', 'Bac / Licence / Master', true, 4
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes traduit en allemand ou en anglais + apostillé', NULL, true, 5
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes traduit en allemand ou en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Certificat de langue', 'Allemand (B2) ou Anglais (B2)', true, 6
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Certificat de langue');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Curriculum Vitae (CV)', 'En anglais ou en allemand', true, 7
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Curriculum Vitae (CV)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Photo d''identité récente', 'Format 35 × 45 mm', true, 8
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Photo d''identité récente');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Formulaire d''inscription', NULL, true, 9
FROM countries c WHERE c.name = 'Allemagne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Formulaire d''inscription');

-- ========================= POLOGNE =========================
INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Copie scannée du passeport', NULL, true, 1
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Copie scannée du passeport');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme original (ou copie conforme)', 'Bac / Licence / Master', true, 2
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme traduit en anglais + apostillé', NULL, true, 3
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme traduit en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes original (ou copie conforme)', 'Bac / Licence / Master', true, 4
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes traduit en anglais + apostillé', NULL, true, 5
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes traduit en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Certificat de langue', 'Anglais (B2)', true, 6
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Certificat de langue');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Curriculum Vitae (CV)', 'En anglais', true, 7
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Curriculum Vitae (CV)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Attestation d''éligibilité (NAWA)', NULL, true, 8
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Attestation d''éligibilité (NAWA)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Photo d''identité récente', 'Format 35 × 45 mm', true, 9
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Photo d''identité récente');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Formulaire d''inscription', NULL, true, 10
FROM countries c WHERE c.name = 'Pologne'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Formulaire d''inscription');

-- ========================= HONGRIE =========================
INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Copie scannée du passeport', NULL, true, 1
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Copie scannée du passeport');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme original (ou copie conforme)', 'Bac / Licence / Master', true, 2
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme traduit en anglais + apostillé', NULL, true, 3
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme traduit en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes original (ou copie conforme)', 'Bac / Licence / Master', true, 4
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes traduit en anglais + apostillé', NULL, true, 5
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes traduit en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Certificat de langue', 'Anglais (B2)', true, 6
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Certificat de langue');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Curriculum Vitae (CV)', 'En anglais', true, 7
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Curriculum Vitae (CV)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Photo d''identité récente', 'Format 35 × 45 mm', true, 8
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Photo d''identité récente');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Formulaire d''inscription', NULL, true, 9
FROM countries c WHERE c.name = 'Hongrie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Formulaire d''inscription');

-- ========================= LITUANIE =========================
INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Copie scannée du passeport', NULL, true, 1
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Copie scannée du passeport');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme original (ou copie conforme)', 'Bac / Licence / Master', true, 2
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Diplôme traduit en anglais + apostillé', NULL, true, 3
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Diplôme traduit en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes original (ou copie conforme)', 'Bac / Licence / Master', true, 4
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes original (ou copie conforme)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Relevé de notes traduit en anglais + apostillé', NULL, true, 5
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Relevé de notes traduit en anglais + apostillé');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Certificat de langue', 'Anglais (B2)', true, 6
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Certificat de langue');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Curriculum Vitae (CV)', 'En anglais', true, 7
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Curriculum Vitae (CV)');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Photo d''identité récente', 'Format 35 × 45 mm', true, 8
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Photo d''identité récente');

INSERT INTO document_requirements (country_id, name, description, required, display_order)
SELECT c.id, 'Formulaire d''inscription', NULL, true, 9
FROM countries c WHERE c.name = 'Lituanie'
  AND NOT EXISTS (SELECT 1 FROM document_requirements WHERE country_id = c.id AND name = 'Formulaire d''inscription');

-- Volontairement AUCUN seed pour : Slovaquie, Roumanie, Malte (aucune liste fournie)
-- et Bulgarie (pays inexistant dans countries — décision métier en attente).
