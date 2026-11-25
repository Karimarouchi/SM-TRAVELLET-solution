import { FancySelect } from "@/components/ui/fancy-select";
import { assignInterviewRdv, fetchStudentInterviews, type StaffInterview } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CheckCircle2, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";

// Carte du conseiller : dès que les documents d'un pays sont validés, un RDV est proposé. Le dossier ne lui est
// transmis qu'une fois confirmé ici ; le conseiller peut aussi choisir un autre RDV (les spécialistes du pays d'abord).
function Row({ interview, onChanged }: { interview: StaffInterview; onChanged: () => void }) {
  const { t } = useLanguage();
  const [rdvId, setRdvId] = useState(interview.rdvId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmed = Boolean(interview.confirmedAt);
  const locked = interview.status === "COMPLETED";
  const specialists = interview.options.filter((o) => o.specialist);
  const unchanged = confirmed && rdvId === interview.rdvId;

  useEffect(() => setRdvId(interview.rdvId || ""), [interview.rdvId]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await assignInterviewRdv(interview.id, rdvId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action impossible.", "Unable to do that."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-dark">{t("Pays", "Country")} : {interview.countryName}</p>
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", locked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : confirmed ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-300 bg-amber-100 text-amber-800")}>
          {locked ? t("Universités choisies", "Universities chosen") : confirmed ? t("RDV confirmé", "File officer confirmed") : t("À confirmer", "To confirm")}
        </span>
      </div>

      <p className="mt-2 text-xs text-muted">
        {specialists.length
          ? t(`RDV responsables de ${interview.countryName} : ${specialists.map((s) => s.name).join(", ")}.`, `File officers in charge of ${interview.countryName}: ${specialists.map((s) => s.name).join(", ")}.`)
          : t(`Aucun RDV n'est spécialisé sur ${interview.countryName} : proposition au RDV le moins chargé.`, `No file officer is specialised in ${interview.countryName}: proposing the least loaded one.`)}
      </p>

      {locked ? (
        <p className="mt-3 text-xs text-mid">{t("Responsable du dossier", "File officer")} : <strong>{interview.rdvName || "—"}</strong></p>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-bold text-mid">{confirmed ? t("RDV qui a le dossier (modifiable)", "File officer (editable)") : t("RDV proposé (modifiable)", "Proposed file officer (editable)")}</label>
            <FancySelect
              value={rdvId}
              onChange={setRdvId}
              options={interview.options.map((o) => ({
                value: o.id,
                label: `${o.name} · ${o.specialist ? t("spécialiste", "specialist") : t("autre", "other")} · ${o.activeLoad} ${t("dossier(s) en cours", "active file(s)")}`
              }))}
              placeholder={t("Aucun RDV disponible", "No file officer available")}
            />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy || !rdvId || unchanged}
              onClick={submit}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {busy ? "…" : confirmed ? t("Changer de RDV", "Change file officer") : t("Confirmer ce RDV", "Confirm this file officer")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewConfirmCard({ studentId, refreshKey = "" }: { studentId: string; refreshKey?: string }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<StaffInterview[]>([]);

  const load = () => fetchStudentInterviews(studentId).then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, refreshKey]);

  if (!items.length) return null;
  const toConfirm = items.some((i) => !i.confirmedAt && i.status !== "COMPLETED");

  return (
    <section className={cn("rounded-[24px] border p-5 shadow-sm sm:p-6", toConfirm ? "border-amber-300 bg-amber-50/60" : "border-line bg-white")}>
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
        <UserCheck className="h-5 w-5 text-brand" aria-hidden />
        {t("Responsable du dossier (RDV)", "File officer (RDV)")}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {toConfirm
          ? t("Les documents sont validés. Confirmez le RDV qui prendra le dossier : il choisira l'université avec l'étudiant lors d'un entretien.", "Documents are approved. Confirm the file officer who will take the file: they will choose the university with the student during an interview.")
          : t("Le RDV qui a le dossier et ceux responsables du pays.", "The file officer in charge and those responsible for the country.")}
      </p>
      <div className="mt-4 space-y-3">
        {items.map((interview) => (
          <Row key={interview.id} interview={interview} onChanged={load} />
        ))}
      </div>
    </section>
  );
}
