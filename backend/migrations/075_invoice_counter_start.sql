-- Reprise de la numérotation : la dernière facture de 2026 est FAC-2026-000081.
INSERT INTO invoice_counters (year, last_number) VALUES (2026, 81)
ON CONFLICT (year) DO UPDATE SET last_number = GREATEST(invoice_counters.last_number, 81);
