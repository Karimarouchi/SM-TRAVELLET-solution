import { cn } from "@/lib/utils";
import { Check, Languages } from "lucide-react";
import type { ChangeEvent } from "react";

export type EditLang = "fr" | "en" | "ar";

const TABS: { value: EditLang; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "ar", label: "العربية" }
];

// Choix de la langue dans laquelle l'admin écrit un contenu du site vitrine (programme, avis).
// Une coche indique qu'une traduction existe ; sans traduction, la vitrine montre le français.
export function LanguageTabs({ value, onChange, filled }: { value: EditLang; onChange: (lang: EditLang) => void; filled: Record<"en" | "ar", boolean> }) {
  return (
    <div className="rounded-2xl border border-brand/20 bg-brand/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
        <Languages className="h-3.5 w-3.5" aria-hidden /> Langue du contenu
      </p>
      <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Langue du contenu">
        {TABS.map((tab) => {
          const done = tab.value !== "fr" && filled[tab.value];
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={value === tab.value}
              onClick={() => onChange(tab.value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition",
                value === tab.value ? "border-brand bg-brand text-white shadow" : "border-line bg-white text-mid hover:border-brand hover:text-brand"
              )}
            >
              {tab.label}
              {done && <Check className={cn("h-3.5 w-3.5", value === tab.value ? "text-white" : "text-emerald-600")} aria-label="traduit" />}
            </button>
          );
        })}
      </div>
      {value === "fr" ? (
        <p className="mt-2 text-[11px] text-muted">Texte principal, obligatoire. Il s'affiche partout où une traduction n'est pas renseignée.</p>
      ) : (
        <p className="mt-2 text-[11px] text-muted">
          Traduction {value === "en" ? "anglaise" : "arabe"} : facultative, affichée aux visiteurs qui choisissent cette langue sur le site. Un champ laissé vide reste en français.
        </p>
      )}
    </div>
  );
}

// Champ de traduction : le texte français d'origine reste visible sous le champ.
export function TranslationField({
  label,
  original,
  value,
  onChange,
  lang,
  multiline = false,
  rows = 3,
  placeholder
}: {
  label: string;
  original?: string;
  value: string;
  onChange: (value: string) => void;
  lang: "en" | "ar";
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const common = {
    value,
    dir: lang === "ar" ? ("rtl" as const) : ("ltr" as const),
    lang,
    placeholder,
    className:
      "w-full rounded-xl border border-line bg-slate-50 px-3 py-2.5 text-sm text-dark placeholder:text-muted outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 transition"
  };
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted">{label}</label>
      {multiline ? (
        <textarea rows={rows} {...common} className={cn(common.className, "resize-none")} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} />
      ) : (
        <input type="text" {...common} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} />
      )}
      {original ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-muted" dir="ltr">
          <span className="font-bold">Français :</span> {original}
        </p>
      ) : null}
    </div>
  );
}
