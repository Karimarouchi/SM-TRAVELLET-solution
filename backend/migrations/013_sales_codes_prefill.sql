-- Code Sales : le pays (et éventuellement quelques champs de contexte)
-- saisis à la génération du code pré-remplissent l'onboarding de l'étudiant
-- qui l'utilise, et deviennent verrouillés (non modifiables par l'étudiant).
-- Email et date de naissance restent TOUJOURS saisis par l'étudiant lui-même
-- (jamais portés par un code).
ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id);
ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS prefill_current_study_level VARCHAR(80);
ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS prefill_target_level VARCHAR(80);
ALTER TABLE sales_codes ADD COLUMN IF NOT EXISTS prefill_phone VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_sales_codes_country ON sales_codes (country_id);

-- Trace, sur le profil étudiant, du code d'activation utilisé — permet de
-- retrouver quels champs ont été pré-remplis par ce code (donc verrouillés).
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS activation_code_id UUID REFERENCES sales_codes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_student_profiles_activation_code ON student_profiles (activation_code_id);
