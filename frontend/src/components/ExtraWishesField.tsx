import UniversityPicker from "@/components/UniversityPicker";
import { FancySelect } from "@/components/ui/fancy-select";
import type { PublicUniversity } from "@/lib/auth";
import { Plus, X } from "lucide-react";

export type ExtraWish = { key: string; country: string; university: string; field: string };

export const MAX_TOTAL_WISHES = 3;

export function newExtraWish(country: string): ExtraWish {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, country, university: "", field: "" };
}

// Une ligne commencée (université ou filière saisie) doit être complète.
export function extraWishProblem(wish: ExtraWish): string {
  const hasAny = wish.university.trim() || wish.field.trim();
  if (!hasAny) return "";
  if (!wish.university.trim()) return "Indiquez l'université du vœu supplémentaire.";
  if (!wish.field.trim()) return "Indiquez la filière du vœu supplémentaire.";
  return "";
}

// Vœux supplémentaires de l'onboarding : le premier vœu est celui des champs
// « formation » et « université » ; ici l'étudiant en ajoute jusqu'à 2 autres
// (autre faculté, ou même faculté dans une autre filière).
export default function ExtraWishesField({
  wishes,
  onChange,
  countries,
  universities,
  hasPrimary
}: {
  wishes: ExtraWish[];
  onChange: (next: ExtraWish[]) => void;
  /** Pays choisis plus haut dans le formulaire. */
  countries: string[];
  universities: PublicUniversity[];
  /** Le vœu principal (université précise) est-il renseigné ? */
  hasPrimary: boolean;
}) {
  const total = (hasPrimary ? 1 : 0) + wishes.length;
  const maxExtras = MAX_TOTAL_WISHES - (hasPrimary ? 1 : 0);
  const canAdd = wishes.length < maxExtras && countries.length > 0;

  const update = (key: string, patch: Partial<ExtraWish>) => onChange(wishes.map((w) => (w.key === key ? { ...w, ...patch } : w)));

  return (
    <div className="rounded-2xl border border-line bg-white/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-mid">Autres facultés visées</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Vous pouvez postuler à 3 facultés en même temps : plusieurs universités, ou la même dans des filières différentes.
          </p>
        </div>
        <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-bold text-brand">{total} / {MAX_TOTAL_WISHES}</span>
      </div>

      {wishes.length > 0 && (
        <div className="mt-3 space-y-3">
          {wishes.map((wish, index) => (
            <div key={wish.key} className="rounded-xl border border-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand">Vœu {index + 2}</span>
                <button
                  type="button"
                  onClick={() => onChange(wishes.filter((w) => w.key !== wish.key))}
                  aria-label={`Retirer le vœu ${index + 2}`}
                  className="rounded-lg p-1 text-muted transition hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {countries.length > 1 && (
                  <div className="sm:col-span-2">
                    <FancySelect
                      value={wish.country}
                      onChange={(country) => update(wish.key, { country, university: "" })}
                      options={countries}
                      placeholder="Pays"
                    />
                  </div>
                )}
                <UniversityPicker
                  value={wish.university}
                  onChange={(university) => update(wish.key, { university })}
                  options={universities.filter((u) => u.countryName === wish.country).map((u) => ({ value: u.name, label: u.name }))}
                  placeholder="Université (liste ou autre nom)"
                />
                <input
                  value={wish.field}
                  onChange={(e) => update(wish.key, { field: e.target.value })}
                  maxLength={80}
                  placeholder="Filière (ex. Gestion, Droit…)"
                  className="h-[42px] w-full rounded-xl border border-line bg-white/90 px-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-brand"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={!canAdd}
        onClick={() => onChange([...wishes, newExtraWish(countries[0] || "")])}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-2 text-xs font-bold text-brand transition hover:border-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter un autre vœu
      </button>
      {!countries.length && <p className="mt-2 text-[11px] text-muted">Choisissez d'abord un pays préféré.</p>}
    </div>
  );
}
