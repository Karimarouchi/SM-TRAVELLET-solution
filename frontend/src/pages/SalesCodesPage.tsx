import { FancySelect } from "@/components/ui/fancy-select";
import {
  createSalesCode,
  fetchMySalesCodes,
  fetchPublicCountries,
  getSession,
  type Country,
  type SalesCode
} from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CheckCircle2, ClipboardCopy, Globe2, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type FormData = {
  countryId: string;
  prefillCurrentStudyLevel: string;
  prefillTargetLevel: string;
  prefillPhone: string;
};

const EMPTY_FORM: FormData = { countryId: "", prefillCurrentStudyLevel: "", prefillTargetLevel: "", prefillPhone: "" };

const STUDY_LEVELS = ["Baccalauréat", "Licence", "Master", "Doctorat", "Autre"];
const TARGET_LEVELS = ["Licence", "Master", "Doctorat", "Prépa / Foundation", "Autre"];

export default function SalesCodesPage() {
  const { t } = useLanguage();
  const session = getSession();
  const [codes, setCodes] = useState<SalesCode[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchMySalesCodes()
      .then(setCodes)
      .catch((err) => setError(err instanceof Error ? err.message : t("Impossible de charger les codes.", "Unable to load codes.")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    fetchPublicCountries().then(setCountries).catch(() => setCountries([]));
  }, []);

  if (!session?.user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.countryId) {
      setError(t("Choisissez un pays.", "Choose a country."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const created = await createSalesCode({
        countryId: form.countryId,
        prefillCurrentStudyLevel: form.prefillCurrentStudyLevel || undefined,
        prefillTargetLevel: form.prefillTargetLevel || undefined,
        prefillPhone: form.prefillPhone || undefined
      });
      setCodes((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setSuccess(t(`Code ${created.code} généré ✓`, `Code ${created.code} generated ✓`));
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Erreur lors de la génération du code.", "Error while generating the code."));
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const available = codes.filter((c) => !c.used);
  const used = codes.filter((c) => c.used);

  return (
    <main className="mx-auto max-w-5xl px-6 pb-16">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">{t("Espace conseiller", "Advisor area")}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">{t("Codes étudiants", "Student codes")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
          {t(
            "Générez un code à transmettre à un prospect. Il sera automatiquement rattaché à vous et au pays choisi dès qu'il l'utilisera lors de son inscription.",
            "Generate a code to give to a prospect. It will automatically be linked to you and the chosen country as soon as they use it when registering."
          )}
        </p>
      </section>

      {error && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          <X className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {/* Formulaire de création */}
      <section className="mt-6 rounded-[24px] border border-line bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
          <Sparkles className="h-5 w-5 text-brand" /> {t("Générer un nouveau code", "Generate a new code")}
        </h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Pays de destination", "Destination country")} <span className="text-red-500">*</span>
            </label>
            <FancySelect
              value={form.countryId}
              onChange={(id) => setForm((prev) => ({ ...prev, countryId: id }))}
              options={countries.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))}
              placeholder={t("Choisir un pays", "Choose a country")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Téléphone (optionnel)", "Phone (optional)")}
            </label>
            <input
              type="text"
              placeholder="+216..."
              value={form.prefillPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, prefillPhone: e.target.value }))}
              className="w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-brand focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Niveau d'études actuel (optionnel)", "Current study level (optional)")}
            </label>
            <FancySelect
              value={form.prefillCurrentStudyLevel}
              onChange={(v) => setForm((prev) => ({ ...prev, prefillCurrentStudyLevel: v }))}
              options={STUDY_LEVELS}
              placeholder={t("Non renseigné", "Not set")}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">
              {t("Niveau recherché (optionnel)", "Target level (optional)")}
            </label>
            <FancySelect
              value={form.prefillTargetLevel}
              onChange={(v) => setForm((prev) => ({ ...prev, prefillTargetLevel: v }))}
              options={TARGET_LEVELS}
              placeholder={t("Non renseigné", "Not set")}
            />
          </div>
          <p className="text-[11px] text-muted sm:col-span-2">
            {t("Les champs renseignés ici seront pré-remplis", "Fields filled in here will be pre-filled")} <strong>{t("et verrouillés", "and locked")}</strong> {t("chez l'étudiant : il ne pourra pas les modifier lui-même. L'email et la date de naissance restent toujours saisis par l'étudiant.", "for the student: they won't be able to change them. Email and date of birth are always entered by the student.")}
          </p>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-violet-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg hover:opacity-90 transition disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> {saving ? t("Génération...", "Generating...") : t("Générer le code", "Generate code")}
            </button>
          </div>
        </form>
      </section>

      {/* Liste des codes */}
      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-dark">{t("Codes disponibles", "Available codes")} ({available.length})</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {available.map((c) => (
                <article key={c.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-dark">{c.code}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(c.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-bold text-muted hover:border-brand hover:text-brand transition"
                    >
                      <ClipboardCopy className="h-3 w-3" /> {copied === c.code ? t("Copié !", "Copied!") : t("Copier", "Copy")}
                    </button>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                    <Globe2 className="h-3 w-3" /> {c.countryName}
                  </p>
                  {(c.prefillCurrentStudyLevel || c.prefillTargetLevel || c.prefillPhone) && (
                    <p className="mt-1 text-[11px] text-muted">
                      {[c.prefillCurrentStudyLevel, c.prefillTargetLevel, c.prefillPhone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </article>
              ))}
              {!available.length && (
                <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted sm:col-span-2">
                  {t("Aucun code disponible. Générez-en un ci-dessus.", "No code available. Generate one above.")}
                </p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-dark">{t("Codes utilisés", "Used codes")} ({used.length})</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {used.map((c) => (
                <article key={c.id} className="rounded-2xl border border-line bg-white p-4 opacity-80">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg font-bold text-muted line-through">{c.code}</span>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold", "bg-slate-100 text-slate-600")}>
                      {t("Utilisé", "Used")}
                    </span>
                  </div>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted">
                    <Globe2 className="h-3 w-3" /> {c.countryName}
                  </p>
                  <p className="mt-1 text-xs text-dark font-semibold">{c.usedByName}</p>
                </article>
              ))}
              {!used.length && (
                <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted sm:col-span-2">
                  {t("Aucun code utilisé pour l'instant.", "No code used yet.")}
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
