// Montant en toutes lettres, en français (mention « Arrêtée la présente facture à la somme de… »).

const UNITS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

// plural : « vingts » et « cents » prennent leur s seulement s'ils terminent le nombre (ou précèdent million/milliard).
function below100(n, plural) {
  if (n < 20) return UNITS[n];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens === 7) return unit === 1 ? "soixante et onze" : `soixante-${UNITS[10 + unit]}`;
  if (tens === 9) return `quatre-vingt-${UNITS[10 + unit]}`;
  if (tens === 8) return unit === 0 ? (plural ? "quatre-vingts" : "quatre-vingt") : `quatre-vingt-${UNITS[unit]}`;
  if (unit === 0) return TENS[tens];
  return unit === 1 ? `${TENS[tens]} et un` : `${TENS[tens]}-${UNITS[unit]}`;
}

function below1000(n, plural) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const words = [];
  if (hundreds) words.push(hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${rest === 0 && plural ? "s" : ""}`);
  if (rest) words.push(below100(rest, plural));
  return words.join(" ");
}

function integerInWords(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "zéro";
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1e3;
  const parts = [];
  if (billions) parts.push(`${below1000(billions, true)} milliard${billions > 1 ? "s" : ""}`);
  if (millions) parts.push(`${below1000(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
  if (rest) parts.push(below1000(rest, true));
  return parts.join(" ");
}

// 2000 → « Deux mille dinars » ; 1234.5 → « Mille deux cent trente-quatre dinars et cinq cents millimes ».
function amountInWords(amount, currency) {
  const isEuro = currency === "EUR";
  const subunit = isEuro ? 100 : 1000;
  const total = Math.round(Number(amount) * subunit);
  const major = Math.floor(total / subunit);
  const minor = total % subunit;
  const majorName = isEuro ? "euro" : "dinar";
  const minorName = isEuro ? "centime" : "millime";
  // « un million de dinars » : le « de » apparaît quand rien ne suit million / milliard.
  const link = major >= 1e6 && major % 1e6 === 0 ? " de" : "";
  let text = `${integerInWords(major)}${link} ${majorName}${major > 1 ? "s" : ""}`;
  if (minor) text += ` et ${integerInWords(minor)} ${minorName}${minor > 1 ? "s" : ""}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

module.exports = { amountInWords, integerInWords };
