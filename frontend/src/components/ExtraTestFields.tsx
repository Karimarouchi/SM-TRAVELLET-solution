import { FancySelect } from "@/components/ui/fancy-select";
import { EXTRA_TEST_LANGS, type ExtraTest, type ExtraTestLang, type TestLang } from "@/lib/student-profile-form";
import { cn } from "@/lib/utils";

const labelClass = "mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-mid";
const inputClass = (invalid: boolean) =>
  cn(
    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-brand/20",
    invalid ? "border-red-400 focus:border-red-400" : "border-line focus:border-brand"
  );

// Test pour chaque langue supplémentaire cochée (allemand, italien, espagnol) :
// choix du test dans la liste, puis son nom si « Autre ».
export default function ExtraTestFields({
  selected,
  values,
  error,
  onChange
}: {
  selected: TestLang[];
  values: Record<ExtraTestLang, ExtraTest>;
  error?: string;
  onChange: (lang: ExtraTestLang, patch: Partial<ExtraTest>) => void;
}) {
  const active = EXTRA_TEST_LANGS.filter((lang) => selected.includes(lang.id));
  if (!active.length) return null;
  return (
    <>
      {active.map((lang) => {
        const value = values[lang.id];
        return (
          <div key={lang.id} className="grid gap-3">
            <div>
              <label className={labelClass}>
                Test {lang.adjective}
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-brand">Obligatoire</span>
              </label>
              <FancySelect
                invalid={Boolean(error) && !value.test}
                value={value.test}
                onChange={(test) => onChange(lang.id, { test, other: test === "Autre" ? value.other : "" })}
                options={lang.tests}
                placeholder={`Choisir un test ${lang.label.toLowerCase()}`}
              />
            </div>
            {value.test === "Autre" && (
              <div>
                <label className={labelClass}>Précisez le test {lang.adjective}</label>
                <input
                  className={inputClass(Boolean(error) && value.other.trim().length < 2)}
                  maxLength={80}
                  value={value.other}
                  onChange={(e) => onChange(lang.id, { other: e.target.value })}
                />
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
    </>
  );
}
