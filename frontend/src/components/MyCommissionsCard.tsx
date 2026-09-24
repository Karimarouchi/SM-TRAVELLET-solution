import { fetchMyCommissions, type CommissionEarning, type CommissionStage } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { ChevronDown, ChevronUp, Coins } from "lucide-react";
import { useEffect, useState } from "react";

const STAGE_LABELS_FR: Record<CommissionStage, string> = {
  CODE_CLAIMED: "Étudiant inscrit via un code",
  DOCUMENTS_VALIDATED: "Documents du dossier validés",
  APPLIED: "Candidature déposée",
  ACCEPTED: "Candidature acceptée",
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

  useEffect(() => {
    fetchMyCommissions()
      .then((data) => { setEarnings(data.earnings); setTotal(data.total); })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  return (
    <section className="mt-6 rounded-[20px] border border-brand/20 bg-white p-5 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Coins className="h-5 w-5" />
          </span>
          <span className="text-left">
            <span className="block font-display text-lg font-bold text-dark">{t("Mes commissions", "My commissions")}</span>
            <span className="block text-xs text-muted">
              {earnings.length} {t(`gain${earnings.length !== 1 ? "s" : ""} enregistré${earnings.length !== 1 ? "s" : ""}`, `earning${earnings.length !== 1 ? "s" : ""} recorded`)}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-display text-xl font-extrabold text-brand">{total.toFixed(2)} DT</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </span>
      </button>

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
                <span className="shrink-0 font-bold text-emerald-600">{e.amountDinar.toFixed(2)} DT</span>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
