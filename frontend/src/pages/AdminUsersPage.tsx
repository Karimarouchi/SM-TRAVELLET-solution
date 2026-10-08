import { fetchStudentsOverview, setStudentActive, type StudentOverview } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Ban, CheckCircle2, ChevronLeft, ChevronRight, GraduationCap, Search, Trash2, Unlock, UserCog, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { TeamSection } from "@/pages/AdminSalesPage";
import StudentsPipelineBoard, { StageBadge } from "@/components/admin/StudentsPipelineBoard";
import DeleteStudentModal from "@/components/admin/DeleteStudentModal";
import { PassportBadge } from "@/components/PassportBadge";

const STUDENTS_PAGE_SIZE = 10;

// ── Tableau détaillé, toujours affiché sous le pipeline pour garder un accès
// exhaustif (tri visuel, lecture rapide de tous les champs).
function StudentsTable({
  students,
  busyId,
  onToggleBlock,
  onDelete
}: {
  students: StudentOverview[];
  busyId: string | null;
  onToggleBlock: (student: StudentOverview) => void;
  onDelete: (student: StudentOverview) => void;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  // Une recherche ou une suppression change la liste : retour à la première page.
  useEffect(() => setPage(1), [students.length]);
  const pageCount = Math.max(1, Math.ceil(students.length / STUDENTS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = students.slice((currentPage - 1) * STUDENTS_PAGE_SIZE, currentPage * STUDENTS_PAGE_SIZE);
  const profilePath = (student: StudentOverview) => `/conseiller/etudiants/${student.id}`;
  const deleteButton = (student: StudentOverview) => (
    <button
      type="button"
      onClick={() => onDelete(student)}
      title="Supprimer cet étudiant"
      aria-label={`Supprimer ${student.prenom} ${student.nom}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-red-100 hover:text-red-600"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );

  const blockButton = (student: StudentOverview) => (
    <button
      type="button"
      disabled={busyId === student.id}
      onClick={() => onToggleBlock(student)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50",
        student.isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      )}
    >
      {student.isActive ? <><Ban className="h-3.5 w-3.5" /> Bloquer</> : <><Unlock className="h-3.5 w-3.5" /> Débloquer</>}
    </button>
  );

  return (
    <>
    {/* Téléphone : une carte par étudiant, toutes les infos et l'action visibles. */}
    <div className="space-y-3 sm:hidden">
      {paged.map((student) => (
        <div key={student.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <Link to={profilePath(student)} className="min-w-0 flex-1" aria-label={`Ouvrir le profil de ${student.prenom} ${student.nom}`}>
              <p className="truncate text-sm font-bold text-dark">{student.prenom} {student.nom}</p>
              <p className="truncate text-xs text-muted">{student.email}</p>
              <span className="mt-1 inline-block text-[11px] font-bold text-brand">Voir le profil →</span>
            </Link>
            {!student.isActive && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <Ban className="h-3 w-3" /> Bloqué
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StageBadge stage={student.stage} />
            <PassportBadge status={student.passportStatus} expiresOn={student.passportExpiresOn} monthsLeft={student.passportMonthsLeft} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <p className="min-w-0 truncate text-xs text-mid">
              <span className="text-muted">Conseiller : </span>{student.assignedSalesName || "—"}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {blockButton(student)}
              {deleteButton(student)}
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="hidden overflow-hidden rounded-2xl border border-line bg-white shadow-sm sm:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-slate-50">
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Étudiant</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">Conseiller</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Étape</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Passeport</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Compte</th>
            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {paged.map((student) => (
            <tr
              key={student.id}
              onClick={() => navigate(profilePath(student))}
              className="cursor-pointer transition hover:bg-brand/5"
              title="Ouvrir le profil détaillé"
            >
              <td className="px-4 py-3">
                {/* Vrai lien (clavier, ouverture dans un nouvel onglet) ; le clic sur la ligne entière fait pareil. */}
                <Link to={profilePath(student)} onClick={(e) => e.stopPropagation()} className="block hover:underline">
                  <p className="text-xs font-bold text-dark">{student.prenom} {student.nom}</p>
                  <p className="text-[11px] text-muted">{student.email}</p>
                </Link>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-xs text-mid">{student.assignedSalesName || "—"}</td>
              <td className="px-4 py-3"><StageBadge stage={student.stage} /></td>
              <td className="px-4 py-3 hidden md:table-cell">
                <PassportBadge status={student.passportStatus} expiresOn={student.passportExpiresOn} monthsLeft={student.passportMonthsLeft} showDate />
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {student.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    <Ban className="h-3 w-3" /> Bloqué
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  {blockButton(student)}
                  {deleteButton(student)}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {students.length > STUDENTS_PAGE_SIZE && (
      <nav className="mt-3 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination des étudiants">
        <p className="text-xs text-muted">
          Étudiants {(currentPage - 1) * STUDENTS_PAGE_SIZE + 1}–{Math.min(currentPage * STUDENTS_PAGE_SIZE, students.length)} sur {students.length}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Précédent
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === currentPage ? "page" : undefined}
              className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition", n === currentPage ? "bg-brand text-white shadow" : "border border-line bg-white text-mid hover:border-brand hover:text-brand")}
            >
              {n}
            </button>
          ))}
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
            Suivant <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </nav>
    )}
    </>
  );
}

type UsersTab = "etudiants" | "conseillers" | "rdv";

const USERS_TABS: Array<{ id: UsersTab; label: string; icon: typeof Users }> = [
  { id: "etudiants", label: "Étudiants", icon: GraduationCap },
  { id: "conseillers", label: "Conseillers", icon: Users },
  { id: "rdv", label: "Responsables Visa", icon: UserCog }
];

function tabFromParam(value: string | null): UsersTab {
  return value === "conseillers" || value === "rdv" ? value : "etudiants";
}

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = tabFromParam(searchParams.get("tab"));
  const [tab, setTab] = useState<UsersTab>(requestedTab);
  // Un lien du Dashboard peut changer l'onglet sans recharger la page.
  useEffect(() => { setTab(requestedTab); }, [requestedTab]);
  const switchTab = (next: UsersTab) => {
    setTab(next);
    setSearchParams(next === "etudiants" ? {} : { tab: next }, { replace: true });
  };
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentOverview | null>(null);
  const [notice, setNotice] = useState("");

  const load = () => {
    setLoading(true);
    fetchStudentsOverview()
      .then((data) => { setStudents(data.students || []); setError(""); })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les utilisateurs."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      `${s.prenom} ${s.nom} ${s.email}`.toLowerCase().includes(q)
    );
  }, [students, search]);

  async function toggleBlock(student: StudentOverview) {
    setBusyId(student.id);
    const nextActive = !student.isActive;
    try {
      await setStudentActive(student.id, nextActive);
      setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, isActive: nextActive } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusyId(null);
    }
  }

  const blockedCount = students.filter((s) => !s.isActive).length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-16">
      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 sm:p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">Espace administrateur</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">Utilisateurs</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              {tab === "etudiants"
                ? "Vue d'ensemble des étudiants, leur avancement réel dans le pipeline (candidature + visa), et le statut de leur compte."
                : "Conseillers et responsables dossier visa : comptes, rôles, permissions et répartition des étudiants."}
            </p>
          </div>
          <div className={cn("flex gap-3", tab !== "etudiants" && "hidden")}>
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-center">
              <p className="font-display text-2xl font-extrabold">{students.length}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/80">Étudiants</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 text-center">
              <p className="font-display text-2xl font-extrabold">{blockedCount}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/80">Bloqués</p>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-3 gap-1 rounded-xl bg-white/10 p-1 backdrop-blur sm:inline-flex sm:items-center">
          {USERS_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] font-bold leading-tight transition sm:flex-row sm:gap-1.5 sm:px-4 sm:text-xs",
                tab === item.id ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" /> {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab !== "etudiants" ? (
        <TeamSection tab={tab === "rdv" ? "rdv" : "sales"} />
      ) : (
      <>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}

      {/* ── Recherche ────────────────────────────────────────────────────── */}
      <div className="mt-6">
        <div className="relative w-full max-w-xs sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un étudiant..."
            className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-brand"
          />
        </div>
      </div>

      {loading && <p className="mt-6 text-sm text-muted">Chargement...</p>}

      {/* ── Pipeline (colonnes toujours visibles, bulles avatar au survol) ── */}
      {!loading && (
        <div className="mt-6">
          <StudentsPipelineBoard students={filtered} busyId={busyId} onToggleBlock={toggleBlock} />
        </div>
      )}

      {!loading && !filtered.length && (
        <p className="mt-6 rounded-[20px] border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          Aucun étudiant ne correspond à cette recherche.
        </p>
      )}

      {/* Sous le pipeline, le tableau complet reste toujours visible pour un
          accès exhaustif (tri, lecture rapide de tous les champs). */}
      {!loading && filtered.length > 0 && (
        <div className="mt-2">
          <StudentsTable students={filtered} busyId={busyId} onToggleBlock={toggleBlock} onDelete={setDeleteTarget} />
        </div>
      )}

      </>
      )}

      {deleteTarget && (
        <DeleteStudentModal
          student={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onBlockInstead={() => toggleBlock(deleteTarget)}
          onDeleted={() => {
            setStudents((prev) => prev.filter((s) => s.id !== deleteTarget.id));
            setNotice(`${deleteTarget.prenom} ${deleteTarget.nom} a été supprimé définitivement.`);
            setDeleteTarget(null);
            window.setTimeout(() => setNotice(""), 5000);
          }}
        />
      )}
    </main>
  );
}
