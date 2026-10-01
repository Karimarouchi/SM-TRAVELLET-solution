import { fetchStudentsOverview, type PipelineStageKey, type StudentOverview } from "@/lib/auth";
import { PassportBadge } from "@/components/PassportBadge";
import { STAGE_META } from "@/components/admin/StudentsPipelineBoard";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { ArrowLeft, Ban, GraduationCap, Mail, Phone, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

const STAGE_KEYS = Object.keys(STAGE_META) as PipelineStageKey[];

// Tous les étudiants d'une étape du pipeline, en cartes (ouverte depuis le
// bouton « Voir tout » de chaque colonne du Dashboard et de la page Utilisateurs).
export default function AdminPipelineStagePage() {
  const { stage: param = "" } = useParams();
  const navigate = useNavigate();
  const stage = STAGE_KEYS.find((key) => key === param);
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchStudentsOverview()
      .then((data) => setStudents(data.students || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les étudiants."))
      .finally(() => setLoading(false));
  }, []);

  // Changer d'étape vide la recherche : elle ne s'applique qu'à l'étape affichée.
  useEffect(() => {
    setSearch("");
  }, [stage]);

  const counts = useMemo(() => {
    const map = new Map<PipelineStageKey, number>();
    for (const student of students) map.set(student.stage, (map.get(student.stage) || 0) + 1);
    return map;
  }, [students]);

  const inStage = useMemo(() => students.filter((s) => s.stage === stage), [students, stage]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inStage;
    return inStage.filter((s) => `${s.prenom} ${s.nom} ${s.email} ${s.phone}`.toLowerCase().includes(q));
  }, [inStage, search]);

  if (!stage) return <Navigate to="/admin/users" replace />;
  const meta = STAGE_META[stage];

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/admin/users"))}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-mid shadow-sm transition hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </button>

      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <p className="text-sm text-white/80">Étape du pipeline</p>
        <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-3xl font-extrabold">
          {meta.label}
          <span className="rounded-full bg-white/20 px-3 py-1 text-base font-bold">{loading ? "…" : inStage.length}</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">
          Tous les étudiants qui se trouvent actuellement à cette étape. Ouvrez une carte pour voir le profil détaillé.
        </p>
      </section>

      {/* Autres étapes : un clic suffit pour passer de l'une à l'autre. */}
      <nav aria-label="Étapes du pipeline" className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {STAGE_KEYS.map((key) => {
          const count = counts.get(key) || 0;
          const selected = key === stage;
          return (
            <Link
              key={key}
              to={`/admin/pipeline/${key}`}
              replace
              aria-current={selected ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                selected ? "border-brand bg-brand text-white shadow" : "border-line bg-white text-mid hover:border-brand/40 hover:text-brand"
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", selected ? "bg-white" : STAGE_META[key].dot)} />
              {STAGE_META[key].label}
              <span className={cn("rounded-full px-1.5 text-[10px]", selected ? "bg-white/25" : "bg-slate-100 text-muted")}>{count}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        <div className="relative w-full max-w-xs sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans cette étape..."
            aria-label="Rechercher dans cette étape"
            className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand"
          />
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-6 text-sm text-muted">Chargement...</p>}

      {!loading && !error && !filtered.length && (
        <p className="mt-6 rounded-[20px] border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          {inStage.length ? "Aucun étudiant ne correspond à cette recherche." : "Aucun étudiant à cette étape pour le moment."}
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((student) => (
          <StudentCard key={student.id} student={student} />
        ))}
      </div>
    </main>
  );
}

function StudentCard({ student }: { student: StudentOverview }) {
  const name = `${student.prenom} ${student.nom}`.trim();
  const apps = student.applications || [];
  return (
    <Link
      to={`/conseiller/etudiants/${student.id}`}
      className={cn(
        "group flex min-w-0 flex-col rounded-[20px] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg",
        student.isActive ? "border-line" : "border-dashed border-slate-300 opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar name={name} src={student.avatarUrl} size="lg" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-base font-bold text-dark group-hover:text-brand">{name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{student.email}</span>
          </p>
          {student.phone && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <Phone className="h-3 w-3 shrink-0" /> {student.phone}
            </p>
          )}
        </div>
        {!student.isActive && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
            <Ban className="h-3 w-3" /> Bloqué
          </span>
        )}
      </div>

      <dl className="mt-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <UserRound className="h-3.5 w-3.5 shrink-0 text-brand" />
          <dt className="sr-only">Conseiller</dt>
          <dd className="min-w-0 truncate text-mid">
            {student.assignedSalesName ? (
              <>
                <span className="font-semibold">{student.assignedSalesName}</span> · conseiller
              </>
            ) : (
              <span className="font-semibold text-amber-600">Aucun conseiller assigné</span>
            )}
          </dd>
        </div>
        {(student.targetField || student.preferredCountries.length > 0) && (
          <div className="flex items-start gap-2">
            <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
            <dt className="sr-only">Projet</dt>
            <dd className="min-w-0 text-mid">
              {student.targetField && <span className="block truncate">{student.targetField}</span>}
              {student.preferredCountries.length > 0 && <span className="block truncate text-muted">{student.preferredCountries.join(", ")}</span>}
            </dd>
          </div>
        )}
      </dl>

      {apps.length > 0 && (
        <ul className="mt-3 space-y-1">
          {apps.slice(0, 2).map((app) => (
            <li key={app.id} className="truncate rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-mid">
              {app.universityName || "Université"} · {app.countryName}
            </li>
          ))}
          {apps.length > 2 && <li className="px-1 text-[11px] font-semibold text-muted">+ {apps.length - 2} autre{apps.length - 2 > 1 ? "s" : ""}</li>}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <PassportBadge status={student.passportStatus} expiresOn={student.passportExpiresOn} monthsLeft={student.passportMonthsLeft} />
        <span className="text-[11px] font-bold text-brand">Voir le profil →</span>
      </div>
    </Link>
  );
}
