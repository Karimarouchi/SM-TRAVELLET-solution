import UniversityDocumentsEditor from "@/components/UniversityDocumentsEditor";
import { fetchStudentUniversityChoices, type UniversityChoice } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FileText, GraduationCap, Info, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Sur la fiche d'un étudiant : une université hors conventions peut demander des
// documents en plus de ceux du pays. Le conseiller les ajoute ici, au-dessus de la
// liste des documents. L'université est conservée dans la liste de son pays avec ces
// documents : le prochain étudiant qui la choisit les retrouve automatiquement.
export default function NonPartnerDocsCard({ studentId, refreshKey, onChanged }: { studentId: string; refreshKey: number; onChanged: () => void }) {
  const [choices, setChoices] = useState<UniversityChoice[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetchStudentUniversityChoices(studentId)
      .then((summary) => setChoices(summary.choices))
      .catch(() => setChoices([]));
  }, [studentId, refreshKey, version]);

  // Une ligne par université hors conventions (une même université peut avoir plusieurs filières).
  const universities = useMemo(() => {
    const map = new Map<string, UniversityChoice>();
    for (const choice of choices) if (!choice.partner && !map.has(choice.universityId)) map.set(choice.universityId, choice);
    return [...map.values()];
  }, [choices]);

  if (!universities.length) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-dark">
        <GraduationCap className="h-5 w-5 text-amber-600" aria-hidden /> Université hors conventions : documents demandés
      </h2>
      <p className="mt-1 flex items-start gap-1.5 text-xs text-mid">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
        Si l'université demande un document en plus de ceux du pays, ajoutez-le ici. L'université est gardée dans la liste du pays avec ses documents :
        le prochain étudiant qui la choisit les aura automatiquement.
      </p>

      <ul className="mt-3 space-y-2">
        {universities.map((uni) => {
          const isOpen = open === uni.universityId;
          return (
            <li key={uni.universityId} className="rounded-xl border border-line bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-dark">{uni.universityName}</p>
                  <p className="text-[11px] text-muted">
                    {uni.countryName} · {uni.specificDocsCount > 0 ? `${uni.specificDocsCount} document${uni.specificDocsCount > 1 ? "s" : ""} spécifique${uni.specificDocsCount > 1 ? "s" : ""}` : "aucun document spécifique pour l'instant"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : uni.universityId)}
                  aria-expanded={isOpen}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                    isOpen ? "border border-line bg-white text-mid hover:bg-slate-50" : "bg-brand text-white hover:opacity-90"
                  )}
                >
                  {isOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {isOpen ? "Fermer" : <>Ajouter un document pour {uni.universityName}</>}
                </button>
              </div>
              {isOpen && (
                <div className="mt-3">
                  <UniversityDocumentsEditor
                    universityId={uni.universityId}
                    universityName={uni.universityName}
                    onChanged={() => {
                      setVersion((v) => v + 1);
                      onChanged();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted"><FileText className="h-3 w-3" aria-hidden /> Les documents ajoutés apparaissent tout de suite dans la liste « Documents » de l'étudiant.</p>
    </section>
  );
}
