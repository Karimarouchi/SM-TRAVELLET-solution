-- Célébration affichée une seule fois à l'étudiant, à sa première ouverture après l'acceptation.
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS university_celebrated_at TIMESTAMPTZ;
ALTER TABLE university_applications ADD COLUMN IF NOT EXISTS visa_celebrated_at TIMESTAMPTZ;

-- Les acceptations déjà passées ne déclenchent pas de célébration.
UPDATE university_applications SET university_celebrated_at = NOW() WHERE status = 'ACCEPTED';
UPDATE university_applications SET visa_celebrated_at = NOW() WHERE visa_status = 'ACCEPTED';
