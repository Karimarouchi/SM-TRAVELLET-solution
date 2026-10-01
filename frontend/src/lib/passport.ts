// Règles du passeport côté navigateur : elles reprennent celles du serveur
// (backend/src/services/passport.js) pour l'avertissement en direct. Le serveur
// reste l'autorité : il recalcule tout.

// Un passeport qui expire dans moins de 24 mois est signalé.
export const PASSPORT_MIN_VALIDITY_MONTHS = 24;

export type PassportStatus = "NONE" | "UNKNOWN" | "EXPIRED" | "EXPIRING" | "VALID";

const MAX_YEARS_PAST = 10;
const MAX_YEARS_FUTURE = 15;

export function normalizePassportNumber(raw: string) {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function validatePassportNumber(raw: string): string {
  const number = normalizePassportNumber(raw);
  if (!number) return "Indiquez le numéro de votre passeport.";
  if (!/^[A-Z0-9]{5,20}$/.test(number)) return "5 à 20 lettres ou chiffres (sans symboles).";
  return "";
}

export function parseExpiry(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function validatePassportExpiry(iso: string): string {
  if (!iso.trim()) return "Indiquez la date d'expiration de votre passeport.";
  const date = parseExpiry(iso);
  if (!date) return "Date d'expiration invalide.";
  const now = new Date();
  const min = new Date(now.getFullYear() - MAX_YEARS_PAST, now.getMonth(), now.getDate());
  const max = new Date(now.getFullYear() + MAX_YEARS_FUTURE, now.getMonth(), now.getDate());
  if (date < min || date > max) return "Cette date ne semble pas correcte. Vérifiez-la sur votre passeport.";
  return "";
}

function addMonths(date: Date, months: number) {
  const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate(), 12, 0, 0);
  if (result.getDate() !== date.getDate()) result.setDate(0);
  return result;
}

export function monthsLeft(expiry: Date, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  let months = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());
  if (expiry.getDate() < today.getDate()) months -= 1;
  return months;
}

export function passportStatusOf(hasPassport: boolean | null, expiresOn: string, now = new Date()): PassportStatus {
  if (hasPassport === false) return "NONE";
  const expiry = parseExpiry(expiresOn);
  if (!expiry) return "UNKNOWN";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (expiry < today) return "EXPIRED";
  if (expiry < addMonths(today, PASSPORT_MIN_VALIDITY_MONTHS)) return "EXPIRING";
  return "VALID";
}

export function formatDateFr(iso: string) {
  const date = parseExpiry(iso);
  return date ? date.toLocaleDateString("fr-FR") : "";
}

export function monthsLabel(months: number) {
  if (months < 1) return "moins d'un mois";
  return `${months} mois`;
}
