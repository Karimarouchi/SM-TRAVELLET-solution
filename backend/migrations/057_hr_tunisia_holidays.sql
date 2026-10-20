-- Calendrier tunisien chargé avec le backend.
-- Payé = jour chômé payé du secteur privé (article 445). L'admin peut changer ensuite.
-- Les fêtes religieuses de 2026 reprennent les dates annoncées. Les années suivantes
-- n'ont que les dates fixes : les fêtes lunaires seront ajoutées après l'annonce officielle.

INSERT INTO hr_holidays (day, label, paid)
SELECT make_date(year, month, day), label, paid
FROM generate_series(2026, 2028) AS year
CROSS JOIN (VALUES
  (1, 1, 'Jour de l''An', FALSE),
  (3, 20, 'Fête de l''Indépendance', TRUE),
  (4, 9, 'Journée des Martyrs', FALSE),
  (5, 1, 'Fête du Travail', TRUE),
  (7, 25, 'Fête de la République', TRUE),
  (8, 13, 'Fête de la Femme', FALSE),
  (10, 15, 'Fête de l''Évacuation', FALSE),
  (12, 17, 'Fête de la Révolution', TRUE)
) AS fixed(month, day, label, paid)
ON CONFLICT (day) DO NOTHING;

INSERT INTO hr_holidays (day, label, paid) VALUES
  ('2026-03-21', 'Aïd el-Fitr', FALSE),
  ('2026-03-22', 'Aïd el-Fitr', FALSE),
  ('2026-05-27', 'Aïd el-Idha', TRUE),
  ('2026-05-28', 'Aïd el-Idha', FALSE),
  ('2026-06-16', 'Nouvel An hégirien', FALSE),
  ('2026-08-25', 'Mouled', FALSE)
ON CONFLICT (day) DO NOTHING;

UPDATE hr_holidays
SET label = 'Fête de l''Indépendance · Aïd el-Fitr'
WHERE day = '2026-03-20' AND label = 'Fête de l''Indépendance';
