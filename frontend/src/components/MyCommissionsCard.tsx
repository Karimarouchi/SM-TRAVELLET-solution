import { fetchMyCommissions, type CommissionEarning, type CommissionStage } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Coins, Eye, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STAGE_LABELS_FR: Record<CommissionStage, string> = {
  CODE_CLAIMED: "Étudiant inscrit via un code",
  DOCUMENTS_VALIDATED: "Documents du dossier validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Candidature acceptée",
  VISA_DOCUMENTS_VALIDATED: "Documents visa validés",
  VISA_SUBMITTED: "Dossier visa déposé",
  VISA_ACCEPTED: "Visa accepté"
};

// Commissions d'un responsable RDV : par inscription (candidature déposée, acceptée)
// ou par visa (dossier déposé, visa accepté).
export const RDV_INSCRIPTION_STAGES: CommissionStage[] = ["APPLIED", "ACCEPTED"];
export const RDV_VISA_STAGES: CommissionStage[] = ["VISA_SUBMITTED", "VISA_ACCEPTED"];

// Carte « Mes commissions », réutilisée par l'espace Sales et par les deux
// pages du RDV. `stages` limite la carte à un type de commission : chaque page
// n'affiche que les gains qui la concernent.
export default function MyCommissionsCard({ title, stages }: { title?: string; stages?: CommissionStage[] }) {
  const { t } = useLanguage();
  const [all, setAll] = useState<CommissionEarning[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Montants floutés par défaut : personne à côté de l'écran ne les lit.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetchMyCommissions()
      .then((data) => setAll(data.earnings))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  // Se re-floute tout seul après 20 secondes.
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  const earnings = useMemo(() => (stages ? all.filter((e) => stages.includes(e.stage)) : all), [all, stages]);
  const total = useMemo(() => earnings.reduce((sum, e) => sum + e.amountDinar, 0), [earnings]);

  if (!loaded) return null;

  const blur = revealed ? "" : "select-none blur-[8px]";
  const label = revealed ? t("Masquer les montants", "Hide amounts") : t("Afficher les montants", "Show amounts");

  return (
    <section className="rounded-[20px] border border-brand/20 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Coins className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-base font-bold leading-tight text-dark">{title || t("Mes commissions", "My commissions")}</span>
            <span className="mt-0.5 block text-xs text-muted">
              {earnings.length} {t(`gain${earnings.length !== 1 ? "s" : ""} enregistré${earnings.length !== 1 ? "s" : ""}`, `earning${earnings.length !== 1 ? "s" : ""} recorded`)}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={label}
            title={label}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-mid transition hover:border-brand hover:text-brand"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t("Replier", "Collapse") : t("Déplier", "Expand")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-slate-50"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </span>
      </div>

      {/* Le montant a sa propre ligne : il ne peut plus passer sous le titre. */}
      <p aria-hidden={!revealed} className={cn("mt-4 whitespace-nowrap font-display text-3xl font-extrabold leading-none text-brand transition", blur)}>
        {total.toFixed(2)} <span className="text-lg">DT</span>
      </p>

      {open && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-4">
          {!earnings.length ? (
            <p className="text-xs text-muted">{t("Aucune commission pour l'instant.", "No commission yet.")}</p>
          ) : (
            earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-dark">{e.studentName} · {e.countryName}</p>
                  <p className="truncate text-[11px] text-muted">{STAGE_LABELS_FR[e.stage]}</p>
                </div>
                <span className={cn("shrink-0 font-bold text-emerald-600 transition", blur)}>{e.amountDinar.toFixed(2)} DT</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
