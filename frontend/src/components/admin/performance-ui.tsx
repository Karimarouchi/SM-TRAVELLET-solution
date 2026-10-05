import type { PerfDuration, PerformancePeriod, PerfWorkHours, WhatsAppFunnel } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock } from "lucide-react";
import type { ReactNode } from "react";

export const PERIOD_OPTIONS: { id: PerformancePeriod; label: string }[] = [
  { id: "7", label: "7 j" },
  { id: "30", label: "30 j" },
  { id: "90", label: "90 j" },
  { id: "all", label: "Tout" }
];

const DAY_LABELS = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function PeriodSelector({ value, onChange }: { value: PerformancePeriod; onChange: (p: PerformancePeriod) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-1 shadow-sm" role="group" aria-label="Période">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-bold transition",
            value === option.id ? "bg-brand text-white shadow" : "text-muted hover:text-dark"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function WorkHoursNote({ workHours }: { workHours: PerfWorkHours }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-muted">
      <Clock className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        Durées en heures ouvrées : {workHours.days.map((d) => DAY_LABELS[d]).join(" · ")}, {workHours.start}–{workHours.end}. Nuits et jours
        non ouvrés exclus (réglable dans Paramètres).
      </span>
    </p>
  );
}

// Chiffre clé : grand nombre, libellé, précision en dessous.
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  onClick,
  expanded
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning";
  /** Rend la carte cliquable (ex. ouvrir la liste détaillée). */
  onClick?: () => void;
  expanded?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick, "aria-expanded": expanded } : {})}
      className={cn(
        "min-w-0 rounded-2xl border bg-white p-4 text-left",
        tone === "warning" ? "border-amber-200" : "border-line",
        onClick && "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
        onClick && expanded && "ring-2 ring-amber-300"
      )}
    >
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        {tone === "warning" && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />}
        <span className="break-words">{label}</span>
      </p>
      <p className="mt-1 font-display text-2xl font-extrabold leading-tight text-dark">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted">{hint}</p> : null}
      {onClick && (
        <p className="mt-1.5 text-[11px] font-bold text-brand">{expanded ? "Masquer la liste ▲" : "Voir la liste ▼"}</p>
      )}
    </Wrapper>
  );
}

export function durationHint(d: PerfDuration, unit = "mesure") {
  return d.count ? `sur ${d.count} ${unit}${d.count > 1 ? "s" : ""}` : "pas encore de donnée";
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

// « 1 aboutie sur 2 répondues »
export function convertedHint(converted: number, answered: number) {
  return `${plural(converted, "aboutie")} sur ${plural(answered, "répondue")}`;
}

export function percent(value: number | null) {
  return value === null ? "—" : `${value} %`;
}

// Entonnoir WhatsApp en barres horizontales (une seule teinte, étiquettes directes).
export function WhatsAppFunnelBars({ funnel }: { funnel: WhatsAppFunnel }) {
  const total = funnel.conversations;
  const rows = [
    { label: "Conversations", value: funnel.conversations, hint: "le contact a écrit sur la période" },
    { label: "Répondues", value: funnel.answered, hint: "le conseiller a parlé avec le contact" },
    { label: "Code envoyé", value: funnel.codeSent, hint: "parmi les répondues" },
    { label: "Inscrits", value: funnel.registered, hint: "parmi les répondues" },
    { label: "Abouties", value: funnel.converted, hint: "code envoyé ou inscrit" }
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const share = total ? Math.round((row.value / total) * 100) : 0;
        return (
          <div key={row.label} title={`${row.label} : ${row.value} (${share} % des conversations) — ${row.hint}`}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="font-semibold text-dark">{row.label}</span>
              <span className="shrink-0 font-bold text-dark">
                {row.value} <span className="font-medium text-muted">· {share} %</span>
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${share}%` }} />
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 pt-1">
        <StatusChip count={funnel.unanswered} label="sans réponse" />
        <StatusChip count={funnel.notConverted} label={funnel.notConverted > 1 ? "répondues mais non abouties" : "répondue mais non aboutie"} />
      </div>
    </div>
  );
}

export function StatusChip({ count, label }: { count: number; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        count ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-muted"
      )}
    >
      {count > 0 && <AlertTriangle className="h-3 w-3" aria-hidden />}
      {count} {label}
    </span>
  );
}
