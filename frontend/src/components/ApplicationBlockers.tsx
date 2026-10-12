import { type StudentBlockers } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, CircleHelp } from "lucide-react";

const TONES: Record<string, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-slate-200 bg-slate-50 text-slate-600"
};

// « Pourquoi pas encore de candidature ? » : liste des raisons (documents manquants, à valider, refusés, vœu absent…).
// compact = une ligne par raison, sans la liste des documents (listes, cartes) ; sinon le détail complet (profil).
export default function ApplicationBlockers({ blockers, compact = false, className }: { blockers?: StudentBlockers | null; compact?: boolean; className?: string }) {
  if (!blockers || blockers.reasons.length === 0) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      {compact && (
        <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted">
          <CircleHelp className="h-3 w-3" aria-hidden /> Pourquoi sans candidature ?
        </p>
      )}
      {blockers.reasons.map((reason) => (
        <div key={reason.key} className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold leading-snug", TONES[reason.tone] || TONES.info)}>
          <p className="flex items-start gap-1.5">
            {reason.tone === "danger" && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
            <span>{reason.text}</span>
          </p>
          {reason.items && reason.items.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-6 font-medium">
              {(compact ? reason.items.slice(0, 3) : reason.items).map((item) => (
                <li key={item}>{item}</li>
              ))}
              {compact && reason.items.length > 3 && <li className="list-none text-[10px] opacity-80">+ {reason.items.length - 3} autre(s)</li>}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
