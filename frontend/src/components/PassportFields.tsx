import { PASSPORT_MIN_VALIDITY_MONTHS, monthsLabel, monthsLeft, normalizePassportNumber, parseExpiry, passportStatusOf } from "@/lib/passport";
import { cn } from "@/lib/utils";
import { AlertTriangle, XCircle } from "lucide-react";

const labelClass = "mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mid";
const inputClass =
  "w-full rounded-xl border bg-white/90 px-3 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400";

function inputState(hasError: boolean) {
  return hasError
    ? "border-red-400 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
    : "border-line focus:border-brand focus:shadow-[0_0_0_4px_rgba(109,40,217,0.12)]";
}

// Numéro + date d'expiration du passeport, avec avertissement en direct si le
// passeport est expiré ou expire dans moins de 24 mois. Utilisé par
// l'onboarding (champs obligatoires) et par la page Profil (facultatifs).
export default function PassportFields({
  number,
  expiresOn,
  onNumberChange,
  onExpiresOnChange,
  numberError,
  expiresOnError,
  required = true
}: {
  number: string;
  expiresOn: string;
  onNumberChange: (value: string) => void;
  onExpiresOnChange: (value: string) => void;
  numberError?: string;
  expiresOnError?: string;
  required?: boolean;
}) {
  const status = passportStatusOf(true, expiresOn);
  const expiry = parseExpiry(expiresOn);
  const left = expiry ? monthsLeft(expiry) : 0;
  // Pas d'avertissement tant que la date est incomplète ou invalide.
  const warning = !expiresOnError && (status === "EXPIRED" || status === "EXPIRING");

  const tag = required ? (
    <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-bold text-brand">Obligatoire</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-muted">Facultatif</span>
  );

  return (
    <div className="grid min-w-0 gap-4 sm:col-span-2 sm:grid-cols-2">
      <div className="min-w-0 text-left">
        <label className={labelClass} htmlFor="passport-number">
          Numéro de passeport {tag}
        </label>
        <input
          id="passport-number"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
          value={number}
          onChange={(e) => onNumberChange(e.target.value.toUpperCase())}
          onBlur={() => onNumberChange(normalizePassportNumber(number))}
          placeholder="Ex. : AB123456"
          aria-invalid={Boolean(numberError)}
          className={cn(inputClass, "font-mono tracking-wider", inputState(Boolean(numberError)))}
        />
        {numberError && <p className="mt-1 text-xs font-medium text-red-600">{numberError}</p>}
      </div>

      <div className="min-w-0 text-left">
        <label className={labelClass} htmlFor="passport-expiry">
          Date d'expiration {tag}
        </label>
        <input
          id="passport-expiry"
          type="date"
          value={expiresOn}
          onChange={(e) => onExpiresOnChange(e.target.value)}
          aria-invalid={Boolean(expiresOnError)}
          className={cn(inputClass, inputState(Boolean(expiresOnError)))}
        />
        {expiresOnError && <p className="mt-1 text-xs font-medium text-red-600">{expiresOnError}</p>}
      </div>

      {warning && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-snug sm:col-span-2",
            status === "EXPIRED" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          {status === "EXPIRED" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {status === "EXPIRED" ? (
              <>
                <strong>Votre passeport est expiré.</strong> Vous pouvez continuer, mais il faudra le renouveler avant toute démarche. Votre conseiller en sera informé.
              </>
            ) : (
              <>
                <strong>Votre passeport expire dans {monthsLabel(left)}</strong>, soit moins de {PASSPORT_MIN_VALIDITY_MONTHS} mois de validité. Vous pouvez continuer, mais pensez à le
                renouveler : votre conseiller en sera informé.
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
