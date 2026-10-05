import { completeApplicationInterview, type UniversityApplication } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Check, GraduationCap, Plane, X } from "lucide-react";
import { useState } from "react";
import { buildSteps, type StepState } from "./dossierSteps";

const DOT: Record<StepState, string> = {
  done: "bg-emerald-500 text-white",
  current: "bg-brand text-white ring-4 ring-brand/20",
  upcoming: "border-2 border-line bg-slate-50 text-slate-300",
  rejected: "bg-red-500 text-white ring-4 ring-red-100"
};

// Parcours d'une candidature : de l'envoi des documents à la décision du
// visa. Avec plusieurs candidatures, on choisit laquelle suivre.
export default function DossierProgress({
  dossierStage,
  applications,
  selectedId,
  onSelect,
  onRefresh
}: {
  dossierStage: string;
  applications: UniversityApplication[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const application = applications.find((a) => a.id === selectedId) || applications[0] || null;

  const interviewAction = application ? (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await completeApplicationInterview(application.id);
            onRefresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : t("Erreur.", "Error."));
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        <Check className="h-3.5 w-3.5" /> {t("J'ai passé mon entretien", "I've had my interview")}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  ) : null;

  const { steps, headline, tone } = buildSteps({ dossierStage, application, t, interviewAction });

  return (
    <section className="overflow-hidden rounded-[24px] border border-line bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-line/70 bg-gradient-to-r from-brand/5 to-violet-50 px-5 py-4 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
          {tone === "success" ? <Plane className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-dark">{t("Mon parcours", "My journey")}</h2>
          <p className={cn("truncate text-sm font-semibold", tone === "danger" ? "text-red-500" : tone === "success" ? "text-emerald-600" : "text-brand")}>{headline}</p>
        </div>
      </div>

      {applications.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-b border-line/70 px-5 py-3 sm:px-6" role="tablist" aria-label={t("Choisir une candidature", "Choose an application")}>
          {applications.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === application?.id}
              onClick={() => onSelect(a.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                a.id === application?.id ? "border-brand bg-brand text-white" : "border-line bg-white text-mid hover:border-brand/40"
              )}
            >
              {a.universityName}
              {a.fieldOfStudy ? ` · ${a.fieldOfStudy}` : ""}
            </button>
          ))}
        </div>
      )}

      <ol className="px-5 py-5 sm:px-6">
        {steps.map((step, index) => {
          const last = index === steps.length - 1;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", DOT[step.state])}>
                  {step.state === "done" ? <Check className="h-4 w-4" /> : step.state === "rejected" ? <X className="h-4 w-4" /> : index + 1}
                </span>
                {!last && <span className={cn("w-0.5 flex-1", step.state === "done" ? "bg-emerald-400" : "bg-line")} style={{ minHeight: "1.5rem" }} />}
              </div>
              <div className={last ? "" : "pb-5"}>
                <p className={cn("pt-1 text-sm font-semibold", step.state === "upcoming" ? "text-muted" : "text-dark")}>{step.label}</p>
                {step.detail}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
