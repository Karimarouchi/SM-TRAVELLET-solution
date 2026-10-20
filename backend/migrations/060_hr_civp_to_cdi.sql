-- Date à laquelle un CIVP est devenu CDI. Les congés d'avant restent à 1,5 jour.
ALTER TABLE hr_employees
  ADD COLUMN IF NOT EXISTS cdi_from DATE;
