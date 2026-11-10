import { formatMoney, type DiscountKind } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Translate = (fr: string, en: string) => string;
const french: Translate = (fr) => fr;

// Montant de la remise sur le prix de la tranche (même arrondi au centime que le serveur).
export function discountAmountOf(base: number, kind: DiscountKind, value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return kind === "PERCENT" ? Math.round((base * 100 * value) / 100) / 100 : Math.round(value * 100) / 100;
}

export function parseDiscountValue(raw: string): number {
  return raw.trim() ? Number(raw.replace(",", ".")) : 0;
}

// Saisie d'une remise : pourcentage ou montant (dans la monnaie du plan), motif facultatif, et aperçu
// du montant à payer. Partagé entre le panneau de paiement de l'étudiant et la création d'un code.
export default function DiscountFields({
  kind,
  value,
  reason,
  onKind,
  onValue,
  onReason,
  currency,
  base,
  paid = 0,
  t = french
}: {
  kind: DiscountKind;
  value: string;
  reason: string;
  onKind: (kind: DiscountKind) => void;
  onValue: (value: string) => void;
  onReason: (reason: string) => void;
  currency: string;
  /** Prix de la tranche avant remise. */
  base: number;
  /** Déjà encaissé sur la tranche : la remise ne peut pas descendre en dessous. */
  paid?: number;
  t?: Translate;
}) {
  const number = parseDiscountValue(value);
  const amount = discountAmountOf(base, kind, number);
  const maxDiscount = Math.max(0, base - paid);
  const tooHigh = amount > maxDiscount + 0.001 || (kind === "PERCENT" && number > 100);
  const currencySymbol = currency === "EUR" ? "€" : "DT";
  const field = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border border-line bg-white p-1" role="group" aria-label={t("Type de remise", "Discount type")}>
        {(["PERCENT", "AMOUNT"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onKind(option)}
            aria-pressed={kind === option}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition", kind === option ? "bg-brand text-white" : "text-mid hover:bg-slate-50")}
          >
            {option === "PERCENT" ? t("Pourcentage (%)", "Percentage (%)") : `${t("Montant", "Amount")} (${currencySymbol})`}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] font-bold text-mid">
            {kind === "PERCENT" ? t("Remise en %", "Discount in %") : `${t("Remise en", "Discount in")} ${currencySymbol}`} *
          </label>
          <div className="relative">
            <input
              value={value}
              onChange={(e) => onValue(e.target.value)}
              inputMode="decimal"
              placeholder={kind === "PERCENT" ? "10" : "100"}
              className={cn(field, "pr-12")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">{kind === "PERCENT" ? "%" : currencySymbol}</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold text-mid">{t("Motif (facultatif)", "Reason (optional)")}</label>
          <input value={reason} onChange={(e) => onReason(e.target.value)} maxLength={300} placeholder={t("Ex. frère déjà inscrit", "E.g. brother already enrolled")} className={field} />
        </div>
      </div>
      {number > 0 && (
        <p className={cn("rounded-lg px-3 py-2 text-xs font-semibold", tooHigh ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-800")}>
          {tooHigh
            ? t(`La remise dépasse ce qui reste à payer sur cette tranche (${formatMoney(maxDiscount, currency)} au maximum).`, `The discount exceeds what is left to pay on this instalment (${formatMoney(maxDiscount, currency)} at most).`)
            : t(`Remise de ${formatMoney(amount, currency)} : à payer ${formatMoney(base - amount, currency)} au lieu de ${formatMoney(base, currency)}.`, `Discount of ${formatMoney(amount, currency)}: ${formatMoney(base - amount, currency)} to pay instead of ${formatMoney(base, currency)}.`)}
        </p>
      )}
    </div>
  );
}
