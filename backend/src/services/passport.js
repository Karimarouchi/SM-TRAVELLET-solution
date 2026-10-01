// Règles du passeport, partagées par l'onboarding, le profil, la liste admin
// et les notifications.

// Un passeport qui expire dans moins de 24 mois est signalé : la plupart des
// démarches d'études à l'étranger (visa, inscription) exigent une longue
// validité restante.
const PASSPORT_MIN_VALIDITY_MONTHS = 24;

// Plage de dates plausibles pour une date d'expiration saisie : un passeport
// vit 5 à 15 ans. On accepte un passeport déjà expiré (récemment) pour pouvoir
// alerter, mais pas une date absurde.
const MAX_YEARS_PAST = 10;
const MAX_YEARS_FUTURE = 15;

function normalizePassportNumber(raw) {
  return String(raw || "").replace(/[\s-]/g, "").toUpperCase();
}

// Numéros de passeport : lettres et chiffres, 5 à 20 caractères selon les pays.
function isValidPassportNumber(normalized) {
  return /^[A-Z0-9]{5,20}$/.test(normalized);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "2030-05-17" → Date locale à midi (évite tout décalage de fuseau) ou null.
function parseExpiry(raw) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw || "").trim());
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function isPlausibleExpiry(date, now = new Date()) {
  const min = new Date(now.getFullYear() - MAX_YEARS_PAST, now.getMonth(), now.getDate());
  const max = new Date(now.getFullYear() + MAX_YEARS_FUTURE, now.getMonth(), now.getDate());
  return date >= min && date <= max;
}

function addMonths(date, months) {
  const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate(), 12, 0, 0);
  // 31 janvier + 1 mois = 3 mars : on recolle à la fin du mois visé.
  if (result.getDate() !== date.getDate()) result.setDate(0);
  return result;
}

// Mois entiers restants avant l'expiration (0 si moins d'un mois, négatif si expiré).
function monthsLeft(expiry, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  let months = (expiry.getFullYear() - today.getFullYear()) * 12 + (expiry.getMonth() - today.getMonth());
  if (expiry.getDate() < today.getDate()) months -= 1;
  return months;
}

// État du passeport pour le badge et les alertes :
//  NONE      l'étudiant n'a pas (encore) de passeport
//  UNKNOWN   passeport déclaré mais numéro / date non renseignés (anciens comptes)
//  EXPIRED   déjà expiré
//  EXPIRING  expire dans moins de 24 mois
//  VALID     valide au-delà de 24 mois
function passportStatus({ hasPassport, expiresOn }, now = new Date()) {
  if (hasPassport === false) return "NONE";
  const expiry = expiresOn instanceof Date ? expiresOn : parseExpiry(expiresOn);
  if (!expiry) return "UNKNOWN";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (expiry < today) return "EXPIRED";
  if (expiry < addMonths(today, PASSPORT_MIN_VALIDITY_MONTHS)) return "EXPIRING";
  return "VALID";
}

// Date SQL (objet Date renvoyé par pg) → "YYYY-MM-DD" sans décalage de fuseau.
function formatExpiry(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return toIsoDate(value);
}

function isRisky(status) {
  return status === "EXPIRED" || status === "EXPIRING";
}

module.exports = {
  PASSPORT_MIN_VALIDITY_MONTHS,
  normalizePassportNumber,
  isValidPassportNumber,
  parseExpiry,
  isPlausibleExpiry,
  monthsLeft,
  passportStatus,
  formatExpiry,
  isRisky,
  toIsoDate
};
