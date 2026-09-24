import { fetchStudentsOverview, setStudentActive, type StudentOverview } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Ban, CheckCircle2, Search, Unlock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StudentsPipelineBoard, { StageBadge } from "@/components/admin/StudentsPipelineBoard";

// ── Tableau détaillé, toujours affiché sous le pipeline pour garder un accès
// exhaustif (tri visuel, lecture rapide de tous les champs).
function StudentsTable({
  students,
  busyId,
  onToggleBlock
}: {
  students: StudentOverview[];
  busyId: string | null;
  onToggleBlock: (student: StudentOverview) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-slate-50">
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Étudiant</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden sm:table-cell">Conseiller</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted">Étape</th>
            <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-muted hidden md:table-cell">Compte</th>
            <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {students.map((student) => (
            <tr key={student.id} className="transition hover:bg-brand/5">
              <td className="px-4 py-3">
                <p className="text-xs font-bold text-dark">{student.prenom} {student.nom}</p>
                <p className="text-[11px] text-muted">{student.email}</p>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell text-xs text-mid">{student.assignedSalesName || "—"}</td>
              <td className="px-4 py-3"><StageBadge stage={student.stage} /></td>
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
              <td className="px-4 py-3 text-right">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminUsersPage() {
  const [students, setStudents] = useState<StudentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

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
    <main className="mx-auto max-w-[1400px] px-6 pb-16">
      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">Espace administrateur</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">Utilisateurs</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              Vue d'ensemble des étudiants, leur avancement réel dans le pipeline (candidature + visa), et le statut de leur compte.
            </p>
          </div>
          <div className="flex gap-3">
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
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

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
          <StudentsTable students={filtered} busyId={busyId} onToggleBlock={toggleBlock} />
        </div>
      )}
    </main>
  );
}
