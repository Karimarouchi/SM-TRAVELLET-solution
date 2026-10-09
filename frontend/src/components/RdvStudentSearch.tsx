import { type RdvMyApplication } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowRight, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function stepLabel(app: RdvMyApplication, t: (fr: string, en: string) => string) {
  if (app.visaStatus === "ACCEPTED") return t("Visa obtenu", "Visa granted");
  if (app.visaStatus === "REJECTED") return t("Visa refusé", "Visa refused");
  if (app.visaStatus === "SUBMITTED") return t("Visa déposé", "Visa filed");
  if (app.visaStatus === "PREPARATION") return t("Visa en préparation", "Visa in preparation");
  switch (app.status) {
    case "READY_TO_APPLY": return t("Prête à postuler", "Ready to apply");
    case "APPLIED":
    case "WAITING_UNIVERSITY_RESPONSE": return t("En attente de l'université", "Awaiting the university");
    case "INTERVIEW_REQUIRED":
    case "INTERVIEW_SCHEDULED":
    case "INTERVIEW_COMPLETED": return t("Entretien", "Interview");
    case "ACCEPTED": return t("Acceptée", "Accepted");
    case "REJECTED": return t("Refusée", "Rejected");
    case "POSTPONED": return t("Reportée", "Postponed");
    default: return t("Terminée", "Closed");
  }
}

// Recherche parmi TOUS les étudiants affectés au Responsable Dossier (candidatures en cours, visas, reportées, terminées).
export default function RdvStudentSearch({ applications }: { applications: RdvMyApplication[] }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");

  const students = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; apps: RdvMyApplication[] }>();
    for (const app of applications) {
      const entry = map.get(app.studentId) || { id: app.studentId, name: app.studentName, email: app.studentEmail, apps: [] };
      entry.apps.push(app);
      map.set(app.studentId, entry);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [applications]);

  const q = norm(query.trim());
  const results = q ? students.filter((s) => norm(`${s.name} ${s.email}`).includes(q)) : [];

  return (
    <section className="mt-6" aria-label={t("Recherche d'étudiant", "Student search")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(`Rechercher parmi vos ${students.length} étudiant${students.length > 1 ? "s" : ""} (nom ou e-mail)…`, `Search among your ${students.length} student(s) (name or email)…`)}
          className="w-full rounded-2xl border border-line bg-white py-3 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      {q && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">{t("Aucun étudiant ne correspond.", "No matching student.")}</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {results.slice(0, 10).map((s) => (
                <li key={s.id}>
                  <Link to={`/rdv/etudiants/${s.id}`} className={cn("flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-brand/5")}>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><UserRound className="h-4 w-4" aria-hidden /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-dark">{s.name}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {s.apps.map((a) => `${a.countryName} · ${a.universityName} (${stepLabel(a, t)})`).join("  |  ")}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {results.length > 10 && <p className="border-t border-line/60 px-4 py-2 text-[11px] text-muted">{t(`+ ${results.length - 10} autre(s) résultat(s) : précisez la recherche.`, `+ ${results.length - 10} more: refine your search.`)}</p>}
        </div>
      )}
    </section>
  );
}
