import { FancySelect } from "@/components/ui/fancy-select";
import {
  chooseInterviewUniversities,
  fetchRdvInterviews,
  fetchUniversityPicker,
  scheduleStudentInterview,
  type InterviewPick,
  type StudentInterview,
  type UniversityPickerItem
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CalendarClock, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const OTHER = "__other__";
const MAX = 3;

type Row = { universityId: string; customName: string; field: string };
const emptyRow = (): Row => ({ universityId: "", customName: "", field: "" });

function InterviewCard({ interview, onChanged }: { interview: StudentInterview; onChanged: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<"" | "schedule" | "choose">("");
  const [date, setDate] = useState("");
  const [link, setLink] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [picker, setPicker] = useState<UniversityPickerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = interview.status === "COMPLETED";

  useEffect(() => {
    if (open === "choose" && !picker.length) fetchUniversityPicker(interview.countryId).then(setPicker).catch(() => undefined);
  }, [open, interview.countryId, picker.length]);

  const options = [...picker.map((u) => ({ value: u.id, label: u.partner ? `${u.name} ★` : u.name })), { value: OTHER, label: t("Autre université (saisir le nom)…", "Other university (type the name)…") }];
  const setRow = (index: number, patch: Partial<Row>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setOpen("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action impossible.", "Unable to do that."));
    } finally {
      setBusy(false);
    }
  };

  const submitSchedule = () => {
    if (!date) return setError(t("Choisissez la date et l'heure.", "Choose the date and time."));
    return run(() => scheduleStudentInterview(interview.id, { date: new Date(date).toISOString(), link: link.trim() || undefined }));
  };

  const submitChoose = () => {
    const picks: InterviewPick[] = [];
    for (const row of rows) {
      const other = row.universityId === OTHER || (picker.length === 0 && row.customName.trim());
      if (!other && !row.universityId) return setError(t("Choisissez une université pour chaque ligne.", "Choose a university on every line."));
      if (other && !row.customName.trim()) return setError(t("Saisissez le nom de l'université.", "Enter the university name."));
      if (!row.field.trim()) return setError(t("Précisez la filière pour chaque université.", "Enter the field for every university."));
      picks.push(other ? { universityName: row.customName.trim(), fieldOfStudy: row.field.trim() } : { universityId: row.universityId, fieldOfStudy: row.field.trim() });
    }
    return run(() => chooseInterviewUniversities(interview.id, picks));
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/rdv/etudiants/${interview.studentId}`} className="text-sm font-bold text-dark hover:text-brand">{interview.studentName}</Link>
          <p className="mt-0.5 text-xs text-muted">
            {interview.countryName}
            {interview.scheduledAt && ` · ${t("entretien le", "interview on")} ${new Date(interview.scheduledAt).toLocaleString("fr-FR")}`}
          </p>
          {interview.meetLink && !done && (
            <a href={interview.meetLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-bold text-brand underline">{t("Lien de visio", "Video link")}</a>
          )}
        </div>
        <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-bold", done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : interview.status === "SCHEDULED" ? "border-sky-200 bg-sky-50 text-sky-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
          {done ? t("Universités choisies", "Universities chosen") : interview.status === "SCHEDULED" ? t("Entretien programmé", "Interview scheduled") : t("À organiser", "To organise")}
        </span>
      </div>

      {!done && !open && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen("schedule")} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-dark hover:border-brand hover:text-brand">
            <CalendarClock className="h-3.5 w-3.5" /> {interview.scheduledAt ? t("Reprogrammer", "Reschedule") : t("Programmer l'entretien", "Schedule interview")}
          </button>
          <button type="button" onClick={() => setOpen("choose")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
            <GraduationCap className="h-3.5 w-3.5" /> {t("Choisir les universités", "Choose universities")}
          </button>
        </div>
      )}

      {open === "schedule" && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">{t("Date et heure", "Date and time")}</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">{t("Lien de visio (optionnel)", "Video link (optional)")}</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(""); setError(""); }} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-muted">{t("Annuler", "Cancel")}</button>
            <button type="button" disabled={busy} onClick={submitSchedule} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{busy ? "…" : t("Enregistrer", "Save")}</button>
          </div>
        </div>
      )}

      {open === "choose" && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-muted">{t(`Choisissez de 1 à ${MAX} universités (et la filière) pour ${interview.studentName}.`, `Choose 1 to ${MAX} universities (and the field) for ${interview.studentName}.`)}</p>
          {rows.map((row, index) => {
            const showCustom = row.universityId === OTHER || picker.length === 0;
            return (
              <div key={index} className="space-y-2 rounded-xl border border-line bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-mid">{t(`Université ${index + 1}`, `University ${index + 1}`)}</span>
                  {rows.length > 1 && (
                    <button type="button" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700" aria-label={t("Retirer", "Remove")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {picker.length > 0 && <FancySelect value={row.universityId} onChange={(value) => setRow(index, { universityId: value })} options={options} placeholder={t("Choisir une université", "Choose a university")} />}
                {showCustom && (
                  <input value={row.customName} onChange={(e) => setRow(index, { customName: e.target.value })} maxLength={200} placeholder={t("Nom de l'université", "University name")} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
                )}
                <input value={row.field} onChange={(e) => setRow(index, { field: e.target.value })} maxLength={120} placeholder={t("Filière (ex. Informatique, Gestion…)", "Field (e.g. Computer science…)")} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
              </div>
            );
          })}
          {rows.length < MAX && (
            <button type="button" onClick={() => setRows((current) => [...current, emptyRow()])} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline">
              <Plus className="h-3.5 w-3.5" /> {t("Ajouter une autre université", "Add another university")}
            </button>
          )}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(""); setError(""); }} className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-muted">{t("Annuler", "Cancel")}</button>
            <button type="button" disabled={busy} onClick={submitChoose} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">{busy ? "…" : t("Valider les choix", "Confirm choices")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Entretiens d'orientation : l'étudiant a ses documents validés pour son pays ; le RDV s'entretient avec lui
// puis choisit les universités (1 à 3) auxquelles il postulera.
export default function RdvInterviewsSection({ onChanged }: { onChanged?: () => void }) {
  const { t } = useLanguage();
  const [items, setItems] = useState<StudentInterview[] | null>(null);

  const load = () => fetchRdvInterviews().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []);

  if (!items || items.length === 0) return null;
  const pending = items.filter((i) => i.status !== "COMPLETED");
  const completed = items.filter((i) => i.status === "COMPLETED").slice(0, 5);

  return (
    <section className="mt-6 rounded-[24px] border border-line bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
        <GraduationCap className="h-5 w-5 text-brand" aria-hidden />
        {t("Entretiens d'orientation", "Orientation interviews")}
        {pending.length > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">{pending.length}</span>}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {t("Documents du pays validés : organisez l'entretien avec l'étudiant puis choisissez avec lui l'université et la filière.", "Country documents approved: hold the interview with the student, then choose the university and field together.")}
      </p>
      <div className="mt-4 space-y-3">
        {[...pending, ...completed].map((interview) => (
          <InterviewCard key={interview.id} interview={interview} onChanged={() => { load(); onChanged?.(); }} />
        ))}
      </div>
    </section>
  );
}
