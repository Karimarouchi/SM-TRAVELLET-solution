import { formatDateFr, monthsLabel, type PassportStatus } from "@/lib/passport";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, CircleHelp, XCircle } from "lucide-react";

const STYLES: Record<PassportStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  VALID: { label: "Valide", className: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  EXPIRING: { label: "Expire bientôt", className: "bg-amber-100 text-amber-800", icon: AlertTriangle },
  EXPIRED: { label: "Expiré", className: "bg-red-100 text-red-700", icon: XCircle },
  NONE: { label: "Sans passeport", className: "bg-slate-100 text-slate-600", icon: CircleHelp },
  UNKNOWN: { label: "À renseigner", className: "bg-slate-100 text-slate-500", icon: CircleHelp }
};

// Pastille d'état du passeport. Icône + texte (jamais la couleur seule). La
// date et les mois restants sont dans l'infobulle et, si demandé, sous la pastille.
export function PassportBadge({
  status,
  expiresOn,
  monthsLeft,
  showDate = false,
  className
}: {
  status: PassportStatus;
  expiresOn?: string;
  monthsLeft?: number | null;
  showDate?: boolean;
  className?: string;
}) {
  const style = STYLES[status] || STYLES.UNKNOWN;
  const Icon = style.icon;
  const date = expiresOn ? formatDateFr(expiresOn) : "";
  const detail =
    status === "EXPIRING" && typeof monthsLeft === "number"
      ? `Expire le ${date} (dans ${monthsLabel(monthsLeft)})`
      : status === "EXPIRED" && date
        ? `Expiré le ${date}`
        : status === "VALID" && date
          ? `Valide jusqu'au ${date}`
          : status === "UNKNOWN"
            ? "Numéro et date d'expiration non renseignés"
            : style.label;

  return (
    <span className={cn("inline-flex flex-col items-start gap-0.5", className)} title={detail}>
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", style.className)}>
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        {status === "EXPIRING" && typeof monthsLeft === "number" ? `Expire dans ${monthsLabel(monthsLeft)}` : style.label}
      </span>
      {showDate && date && (status === "VALID" || status === "EXPIRING" || status === "EXPIRED") && (
        <span className="pl-1 text-[10px] text-muted">{date}</span>
      )}
    </span>
  );
}
