import { fetchMyCommissions, type CommissionEarning, type CommissionStage } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { ChevronDown, ChevronUp, Coins, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

const STAGE_LABELS_FR: Record<CommissionStage, string> = {
  CODE_CLAIMED: "Étudiant inscrit via un code",
  DOCUMENTS_VALIDATED: "Documents du dossier validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Candidature acceptée",
  VISA_DOCUMENTS_VALIDATED: "Documents visa validés",
  VISA_SUBMITTED: "Dossier visa déposé",
  VISA_ACCEPTED: "Visa accepté"
};

// Carte compacte "Mes commissions", réutilisée par l'espace Sales et l'espace RDV.
export default function MyCommissionsCard() {
  const { t } = useLanguage();
  const [earnings, setEarnings] = useState<CommissionEarning[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Montants floutés par défaut : personne à côté de l'écran ne les lit.
  const [revealed, setRevealed] = useState(false);

  // Se re-floute tout seul après 20 secondes.
  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  const blur = revealed ? "" : "select-none blur-[7px]";

  useEffect(() => {
    fetchMyCommissions()
      .then((data) => { setEarnings(data.earnings); setTotal(data.total); })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <section className="mt-6 rounded-[20px] border border-brand/20 bg-white p-5 shadow-sm">
      <div className="flex w-full items-center justify-between gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Coins className="h-5 w-5" />
          </span>
          <span className="min-w-0 text-left">
            <span className="block truncate font-display text-base font-bold text-dark sm:text-lg">{t("Mes commissions", "My commissions")}</span>
            <span className="block text-xs text-muted">
              {earnings.length} {t(`gain${earnings.length !== 1 ? "s" : ""} enregistré${earnings.length !== 1 ? "s" : ""}`, `earning${earnings.length !== 1 ? "s" : ""} recorded`)}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 items-center gap-2">
          <span aria-hidden={!revealed} className={`whitespace-nowrap font-display text-lg font-extrabold text-brand transition sm:text-xl ${blur}`}>{total.toFixed(2)} DT</span>
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t("Masquer les montants", "Hide amounts") : t("Afficher les montants", "Show amounts")}
            title={revealed ? t("Masquer les montants", "Hide amounts") : t("Afficher les montants", "Show amounts")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line text-mid transition hover:border-brand hover:text-brand"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? t("Replier", "Collapse") : t("Déplier", "Expand")} className="text-muted">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </span>
      </div>

      {open && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-4">
          {!earnings.length ? (
            <p className="text-xs text-muted">{t("Aucune commission pour l'instant.", "No commission yet.")}</p>
          ) : (
            earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-dark">{e.studentName} · {e.countryName}</p>
                  <p className="truncate text-[11px] text-muted">{STAGE_LABELS_FR[e.stage]}</p>
                </div>
                <span className={`shrink-0 font-bold text-emerald-600 transition ${blur}`}>{e.amountDinar.toFixed(2)} DT</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
