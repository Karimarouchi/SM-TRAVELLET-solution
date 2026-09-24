CREATE TABLE IF NOT EXISTS programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(150) NOT NULL,
  country VARCHAR(100) NOT NULL,
  degrees VARCHAR(150) NOT NULL DEFAULT 'Licence / Master',
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  badge VARCHAR(100) NOT NULL DEFAULT 'Disponible',
  status_label VARCHAR(100) NOT NULL DEFAULT 'Disponible',
  gradient_style VARCHAR(255) NOT NULL DEFAULT 'linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default programmes if table is empty
INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Italie', 'Italia', 'Licence / Master', 'L’Italie propose une grande diversité de programmes universitaires en Licence et Master, avec des parcours accessibles en italien ou en anglais, dans un cadre académique reconnu en Europe.', 'IMAGE/bled/italie.jpg', 'Disponible', 'Disponible', 'linear-gradient(135deg,#0f172a 0%,#4c1d95 52%,#1d4ed8 100%)', true, 1
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Italia');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Allemagne', 'Allemagne', 'Licence / Master', 'Allemagne 🇩🇪 pour un projet académique ambitieux, une orientation sérieuse et une prise en charge professionnelle de votre dossier.', 'IMAGE/bled/Allemagne.jpg', 'Disponible', 'Disponible', 'linear-gradient(135deg,#111827 0%,#0f766e 52%,#1d4ed8 100%)', true, 2
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Allemagne');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Hongrie', 'Hongrie', 'English course / Licence / Master', 'La Hongrie propose des programmes enseignés en anglais, avec une procédure claire, un accompagnement personnalisé et des parcours adaptés aux étudiants internationaux.', 'IMAGE/bled/Hongrie.webp', 'Disponible', 'Disponible', 'linear-gradient(135deg,#312e81 0%,#7c3aed 52%,#2563eb 100%)', true, 3
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Hongrie');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Lituanie', 'Lithuania', 'Licence / Master', 'La Lituanie propose des programmes enseignés en anglais, avec des parcours préparatoires, Licence et Master adaptés aux étudiants internationaux.', 'IMAGE/bled/Lithuania.webp', 'Disponible', 'Disponible', 'linear-gradient(135deg,#082f49 0%,#0f766e 50%,#16a34a 100%)', false, 4
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Lithuania');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Pologne', 'Poland', 'Licence / Master', 'La Pologne propose des programmes enseignés en anglais, avec un parcours structuré et un accompagnement adapté au niveau et au projet d’études de chaque étudiant.', 'IMAGE/bled/Poland.jpg', 'Disponible', 'Disponible', 'linear-gradient(135deg,#0f172a 0%,#334155 50%,#7c2d12 100%)', false, 5
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Poland');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Slovaquie', 'Slovakia', 'Licence / Master', 'La Slovaquie proposera bientôt des programmes en Licence et Master, avec une orientation personnalisée selon votre profil, votre niveau et votre projet d’études.', 'IMAGE/bled/Slovakia.jpg', 'Prochainement disponible', 'Bientôt ouvert', 'linear-gradient(135deg,#1f2937 0%,#1d4ed8 52%,#7c3aed 100%)', false, 6
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Slovakia');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Roumanie', 'Romania', 'Licence / Master', 'La Roumanie proposera bientôt des programmes en Licence et Master dans un cadre académique structuré, avec plusieurs filières en français, en anglais ou en roumain.', 'IMAGE/bled/Romania.jpg', 'Prochainement disponible', 'Bientôt ouvert', 'linear-gradient(135deg,#7f1d1d 0%,#b91c1c 48%,#f59e0b 100%)', false, 7
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Romania');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Malte', 'Malta', 'Licence / Master', 'Malte proposera bientôt des programmes universitaires en anglais, dans un cadre européen dynamique, adapté aux étudiants internationaux.', 'IMAGE/bled/Malte.jpg', 'Planifié', 'Bientôt ouvert', 'linear-gradient(135deg,#0c4a6e 0%,#0369a1 48%,#0ea5e9 100%)', false, 8
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Malta');

INSERT INTO programmes (title, country, degrees, description, image_url, badge, status_label, gradient_style, is_featured, display_order)
SELECT 'Programme Bulgarie', 'Bulgaria', 'Licence / Master', 'La Bulgarie proposera bientôt des programmes en Licence et Master, avec un accompagnement adapté au profil et au projet d’études de chaque étudiant.', 'IMAGE/bled/bulgarie.jpg', 'Prochainement disponible', 'Bientôt ouvert', 'linear-gradient(135deg,#14532d 0%,#15803d 48%,#84cc16 100%)', false, 9
WHERE NOT EXISTS (SELECT 1 FROM programmes WHERE country = 'Bulgaria');
