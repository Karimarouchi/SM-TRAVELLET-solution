import { confirmDialog } from "@/components/ui/dialog-host";
import UniversityDocumentsEditor from "@/components/UniversityDocumentsEditor";
import { FancySelect } from "@/components/ui/fancy-select";
import {
  addMyUniversityChoice,
  addStudentUniversityChoice,
  fetchMyUniversityChoices,
  fetchPublicCountries,
  fetchStudentUniversityChoices,
  fetchUniversityPicker,
  removeUniversityChoice,
  type Country,
  type UniversityChoice,
  type UniversityChoicesSummary,
  type UniversityPickerItem
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BadgeCheck, FileText, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const OTHER = "__other__";

// Libellé court de l'avancement d'un vœu.
function stageLabel(choice: UniversityChoice, t: (fr: string, en: string) => string) {
  switch (choice.applicationStatus) {
    case null:
    case undefined:
      return { text: t("Documents en cours", "Documents in progress"), tone: "bg-slate-100 text-slate-600 border-slate-200" };
    case "READY_TO_APPLY":
      return { text: t("Prête à postuler", "Ready to apply"), tone: "bg-sky-50 text-sky-700 border-sky-200" };
    case "ACCEPTED":
      return { text: t("Acceptée", "Accepted"), tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "REJECTED":
      return { text: t("Refusée", "Rejected"), tone: "bg-red-50 text-red-600 border-red-200" };
    default:
      return { text: t("Déposée · en attente", "Applied · waiting"), tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }
}

// « Mes candidatures » : jusqu'à 3 universités / filières en même temps.
// Sans studentId : l'étudiant gère les siennes ; avec studentId : un conseiller
// ou un admin gère celles de l'étudiant (et définit les documents des
// universités hors conventions).
export default function UniversityChoicesPanel({ studentId, onChanged }: { studentId?: string; onChanged?: () => void }) {
  const { t } = useLanguage();
  const staff = Boolean(studentId);
  const [summary, setSummary] = useState<UniversityChoicesSummary | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [picker, setPicker] = useState<UniversityPickerItem[]>([]);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [countryId, setCountryId] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [customName, setCustomName] = useState("");
  const [field, setField] = useState("");
  const [docsOpen, setDocsOpen] = useState<string | null>(null);

  const load = () =>
    (studentId ? fetchStudentUniversityChoices(studentId) : fetchMyUniversityChoices())
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : t("Chargement impossible.", "Unable to load.")));

  useEffect(() => {
    load();
    fetchPublicCountries().then(setCountries).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    setUniversityId("");
    setCustomName("");
    setPicker([]);
    if (countryId) fetchUniversityPicker(countryId).then(setPicker).catch(() => undefined);
  }, [countryId]);

  const full = summary ? summary.used >= summary.limit : false;

  const reset = () => {
    setAdding(false);
    setCountryId("");
    setField("");
    setError("");
  };

  const submit = async () => {
    setError("");
    const other = universityId === OTHER || (picker.length === 0 && customName.trim());
    if (!countryId) return setError(t("Choisissez un pays.", "Choose a country."));
    if (!other && !universityId) return setError(t("Choisissez une université.", "Choose a university."));
    if (other && !customName.trim()) return setError(t("Saisissez le nom de l'université.", "Enter the university name."));
    if (!field.trim()) return setError(t("Précisez la filière visée.", "Enter the field of study."));
    setBusy(true);
    try {
      const payload = { countryId, fieldOfStudy: field.trim(), ...(other ? { universityName: customName.trim() } : { universityId }) };
      const next = studentId ? await addStudentUniversityChoice(studentId, payload) : await addMyUniversityChoice(payload);
      setSummary(next);
      reset();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Ajout impossible.", "Unable to add."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (choice: UniversityChoice) => {
    if ((await confirmDialog(t(`Retirer « ${choice.universityName} » (${choice.fieldOfStudy}) ?`, `Remove "${choice.universityName}" (${choice.fieldOfStudy})?`), { tone: "danger", confirmLabel: t("Retirer", "Remove") }))) return;
    try {
      setSummary(await removeUniversityChoice(choice.id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Action impossible.", "Unable to do that."));
    }
  };

  const pickerOptions = [
    ...picker.map((u) => ({ value: u.id, label: u.partner ? `${u.name} ★` : u.name })),
    { value: OTHER, label: t("Autre université (saisir le nom)…", "Other university (type the name)…") }
  ];
  const showCustom = universityId === OTHER || (Boolean(countryId) && picker.length === 0);

  return (
    <section className="mt-6 rounded-[24px] border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
            <GraduationCap className="h-5 w-5 text-brand" aria-hidden />
            {staff ? t("Universités visées", "Target universities") : t("Mes candidatures", "My applications")}
            {summary && (
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                {summary.used} / {summary.limit}
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {t(
              "Jusqu'à 3 candidatures en même temps : 3 universités différentes, ou une même université dans plusieurs filières. Un refus libère une place.",
              "Up to 3 applications at the same time: 3 different universities, or one university in several fields. A rejection frees a slot."
            )}
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            disabled={full}
            onClick={() => setAdding(true)}
            title={full ? t("Limite de 3 candidatures atteinte", "Limit of 3 applications reached") : undefined}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {t("Ajouter une université", "Add a university")}
          </button>
        )}
      </div>

      {error && !adding && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {adding && (
        <div className="mt-4 space-y-3 rounded-2xl border-2 border-dashed border-brand/30 bg-brand/5 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">{t("Pays", "Country")}</label>
              <FancySelect
                value={countryId}
                onChange={setCountryId}
                options={countries.map((c) => ({ value: c.id, label: c.name }))}
                placeholder={t("Choisir un pays", "Choose a country")}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">{t("Université", "University")}</label>
              {countryId && picker.length > 0 ? (
                <FancySelect value={universityId} onChange={setUniversityId} options={pickerOptions} placeholder={t("Choisir une université", "Choose a university")} />
              ) : (
                <p className="rounded-xl border border-line bg-white px-3 py-2.5 text-xs text-muted">
                  {countryId ? t("Aucune université listée : saisissez-la ci-dessous.", "No university listed: type it below.") : t("Choisissez d'abord un pays.", "Pick a country first.")}
                </p>
              )}
            </div>
          </div>
          {showCustom && (
            <div>
              <label className="mb-1 block text-[11px] font-bold text-mid">{t("Nom de l'université", "University name")}</label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={200}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <p className="mt-1 text-[11px] text-muted">
                {t(
                  "Hors conventions : votre conseiller définira les documents spécifiques demandés par cette université.",
                  "Not a partner university: your advisor will define the specific documents it requires."
                )}
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[11px] font-bold text-mid">{t("Filière visée", "Field of study")}</label>
            <input
              value={field}
              onChange={(e) => setField(e.target.value)}
              maxLength={120}
              placeholder={t("ex. Informatique, Gestion…", "e.g. Computer science, Management…")}
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-muted hover:bg-slate-50">
              {t("Annuler", "Cancel")}
            </button>
            <button type="button" disabled={busy} onClick={submit} className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
              {busy ? t("Ajout…", "Adding…") : t("Ajouter", "Add")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {!summary ? (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        ) : summary.choices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-slate-50 p-5 text-sm text-muted">
            {t("Aucune candidature en cours. Ajoutez l'université et la filière que vous visez.", "No application in progress. Add the university and field you are aiming for.")}
          </p>
        ) : (
          summary.choices.map((choice) => {
            const stage = stageLabel(choice, t);
            const removable = !choice.applicationStatus || choice.applicationStatus === "READY_TO_APPLY";
            const missingDocs = !choice.partner && choice.specificDocsCount === 0;
            return (
              <div key={choice.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-dark">
                      {choice.universityName}
                      {choice.partner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          <BadgeCheck className="h-3 w-3" aria-hidden /> {t("Conventionnée", "Partner")}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {choice.fieldOfStudy || t("Filière non précisée", "Field not specified")} · {choice.countryName}
                    </p>
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold", stage.tone)}>{stage.text}</span>
                </div>

                {choice.specificDocsCount > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-mid">
                    <FileText className="h-3 w-3 text-brand" aria-hidden />
                    {t(`${choice.specificDocsCount} document(s) spécifique(s) en plus de ceux du pays`, `${choice.specificDocsCount} specific document(s) on top of the country ones`)}
                  </p>
                )}
                {missingDocs && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
                    {staff
                      ? t("Université hors conventions : définissez ses documents spécifiques (ou aucun).", "Non-partner university: define its specific documents (or none).")
                      : t("Université hors conventions : votre conseiller définira les documents spécifiques demandés.", "Non-partner university: your advisor will define the specific documents required.")}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {staff && !choice.partner && (
                    <button
                      type="button"
                      onClick={() => setDocsOpen(docsOpen === choice.id ? null : choice.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-[11px] font-bold text-brand hover:bg-brand/10"
                    >
                      <FileText className="h-3 w-3" /> {docsOpen === choice.id ? t("Masquer les documents", "Hide documents") : t("Documents de l'université", "University documents")}
                    </button>
                  )}
                  {removable && (
                    <button
                      type="button"
                      onClick={() => remove(choice)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" /> {t("Retirer", "Remove")}
                    </button>
                  )}
                </div>

                {staff && !choice.partner && docsOpen === choice.id && (
                  <div className="mt-3">
                    <UniversityDocumentsEditor universityId={choice.universityId} universityName={choice.universityName} onChanged={load} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
