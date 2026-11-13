-- Type de congé : congé payé (par défaut, ce que sont tous les congés existants), maladie, maternité /
-- paternité, exceptionnel (mariage, décès, naissance…) ou autre. Le type n'ajoute que l'étiquette : un
-- congé accepté retire toujours ses jours ouvrés du solde, et le solde peut passer sous zéro quand
-- l'administrateur le confirme.
ALTER TABLE hr_leave_requests ADD COLUMN IF NOT EXISTS type VARCHAR(12) NOT NULL DEFAULT 'ANNUAL';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hr_leave_requests_type_check') THEN
    ALTER TABLE hr_leave_requests
      ADD CONSTRAINT hr_leave_requests_type_check CHECK (type IN ('ANNUAL', 'SICK', 'MATERNITY', 'SPECIAL', 'OTHER'));
  END IF;
END $$;
