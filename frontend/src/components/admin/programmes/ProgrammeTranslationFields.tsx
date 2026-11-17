import { TranslationField } from "@/components/admin/LanguageTabs";
import type { ProgrammeLevelTranslation, ProgrammeTranslation, ProgrammeTranslations } from "@/lib/auth";
import type { FormData } from "./constants";

type Lang = "en" | "ar";

// Saisie de la version anglaise ou arabe d'un programme : titre, pays affiché, étiquette, description
// et, pour chaque niveau de la fenêtre « Voir les détails », ses textes. Le français est rappelé sous chaque champ.
export function ProgrammeTranslationFields({
  lang,
  formData,
  translations,
  onChange
}: {
  lang: Lang;
  formData: FormData;
  translations: ProgrammeTranslations;
  onChange: (next: ProgrammeTranslations) => void;
}) {
  const current: ProgrammeTranslation = translations[lang] || {};

  const setField = (key: keyof Omit<ProgrammeTranslation, "levels">, value: string) =>
    onChange({ ...translations, [lang]: { ...current, [key]: value } });

  const setLevel = (id: string, key: keyof ProgrammeLevelTranslation, value: string) =>
    onChange({
      ...translations,
      [lang]: { ...current, levels: { ...(current.levels || {}), [id]: { ...(current.levels?.[id] || {}), [key]: value } } }
    });

  const levels = formData.details.filter((level) => level.id);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <TranslationField label="Titre du programme" original={formData.title} value={current.title || ""} onChange={(v) => setField("title", v)} lang={lang} placeholder={lang === "en" ? "e.g. Italy Program" : "مثال: برنامج إيطاليا"} />
        <TranslationField label="Pays (affiché)" original={formData.country} value={current.country || ""} onChange={(v) => setField("country", v)} lang={lang} placeholder={lang === "en" ? "e.g. Italy" : "مثال: إيطاليا"} />
      </div>
      <TranslationField label="Étiquette courte (carte)" original={formData.degrees} value={current.degrees || ""} onChange={(v) => setField("degrees", v)} lang={lang} placeholder={lang === "en" ? "e.g. Bachelor's / Master's" : "مثال: الإجازة / الماجستير"} />
      <TranslationField label="Description" original={formData.description} value={current.description || ""} onChange={(v) => setField("description", v)} lang={lang} multiline rows={4} />

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Niveaux de la fenêtre « Voir les détails »</p>
        {levels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-slate-50 px-4 py-3 text-xs text-muted">
            Aucun niveau : ajoutez-les d'abord dans l'onglet Français, puis traduisez-les ici.
          </p>
        ) : (
          <div className="space-y-3">
            {levels.map((level, index) => {
              const value: ProgrammeLevelTranslation = current.levels?.[level.id as string] || {};
              const set = (key: keyof ProgrammeLevelTranslation) => (v: string) => setLevel(level.id as string, key, v);
              return (
                <div key={level.id} className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
                  <p className="flex items-center gap-2 text-xs font-bold text-dark">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white">{index + 1}</span>
                    {level.name || "Niveau"}
                  </p>
                  <TranslationField label="Titre du niveau" original={level.name} value={value.name || ""} onChange={set("name")} lang={lang} />
                  <TranslationField label="Description" original={level.desc} value={value.desc || ""} onChange={set("desc")} lang={lang} multiline rows={3} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TranslationField label="Langue d'enseignement" original={level.lang} value={value.lang || ""} onChange={set("lang")} lang={lang} />
                    <TranslationField label="Statut" original={level.status} value={value.status || ""} onChange={set("status")} lang={lang} />
                  </div>
                  <TranslationField label="Période d'inscription" original={level.dates} value={value.dates || ""} onChange={set("dates")} lang={lang} />
                  <TranslationField label="Bourses & Avantages" original={level.scholarship} value={value.scholarship || ""} onChange={set("scholarship")} lang={lang} multiline rows={3} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
