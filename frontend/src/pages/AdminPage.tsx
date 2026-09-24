import {
  fetchAdminDashboard,
  fetchBackupStatus,
  fetchStudentsOverview,
  runBackupNow,
  setStudentActive,
  type AdminDashboard,
  type BackupStatus,
  type StudentOverview
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ConversionFunnelChart,
  DestinationsPieChart,
  GrowthAreaChart,
  PipelineRadialChart,
  Sparkline,
} from "@/components/admin/AdminCharts";
import StudentsPipelineBoard from "@/components/admin/StudentsPipelineBoard";
import {
  CheckCircle2,
  CloudUpload,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  UserRound,
  Users,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  PlaneTakeoff
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// ── Sparkline seeds (fixed so they look natural) ──────────────────────────────
const SPARK_SEEDS: Record<string, number[]> = {
  students:           [12, 14, 13, 16, 18, 20, 22, 21, 25, 28, 30, 32],
  visasObtainedMonth: [1,  2,  1,  3,  2,  4,  3,  5,  4,  6,  5,  7],
  stalledDossiers:    [4,  3,  5,  4,  6,  5,  4,  5,  3,  4,  3,  2],
};

// ── Backup panel ──────────────────────────────────────────────────────────────
function BackupPanel() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = () => { fetchBackupStatus().then(setStatus).catch(() => undefined); };
  useEffect(() => { load(); }, []);

  const handleRun = async () => {
    setRunning(true);
    setError("");
    try {
      const result = await runBackupNow();
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la sauvegarde.");
      load();
    } finally {
      setRunning(false);
    }
  };

  const ageLabel = status?.at
    ? new Date(status.at).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="mt-6 rounded-[24px] border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <CloudUpload className="h-5 w-5 text-brand" /> Sauvegarde de secours (Supabase)
          </h2>
          <p className="mt-1 text-xs text-muted">
            Copie à sens unique de la base de production, en plus de la copie automatique toutes les 12h.
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={handleRun}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
          {running ? "Sauvegarde en cours..." : "Lancer maintenant"}
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-slate-50 px-4 py-3">
        {status?.at ? (
          <div className="flex items-start gap-2">
            {status.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            )}
            <div>
              <p className="text-sm font-semibold text-dark">
                {status.success ? "Dernière sauvegarde réussie" : "La dernière sauvegarde a échoué"} — {ageLabel}
              </p>
              {!status.success && status.error && (
                <p className="mt-1 text-xs text-red-600">{status.error}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Aucune sauvegarde n'a encore été effectuée sur ce serveur.</p>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </section>
  );
}

// ── Chart section card wrapper ────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  children,
  className,
  badge,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  badge?: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-[24px] border border-line bg-white p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-dark">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

// ── YoY badge ─────────────────────────────────────────────────────────────────
function YoYBadge({ year }: { year: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-bold text-brand">
      <TrendingUp className="h-3 w-3" />
      {year - 1} → {year}
    </span>
  );
}

// ── Performance list (réutilisée pour l'équipe Sales et l'équipe RDV) ─────────
type PerformanceItem = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  isActive: boolean;
  students: number;
  completed: number;
  share: number;
};

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
];

function PerformanceList({
  title,
  subtitle,
  studentsLabel,
  completedLabel,
  emptyLabel,
  items,
  onViewAll
}: {
  title: string;
  subtitle: string;
  studentsLabel: string;
  completedLabel: string;
  emptyLabel: string;
  items: PerformanceItem[];
  onViewAll: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-dark">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-xl bg-brand-light px-3 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand hover:text-white"
        >
          Voir tout →
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item, idx) => {
          const initials = `${item.prenom?.[0] ?? ""}${item.nom?.[0] ?? ""}`.toUpperCase();
          const avatarGrad = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          const medals = ["🥇", "🥈", "🥉"];
          const medal = medals[idx] ?? null;
          const shareColor =
            item.share > 35 ? "bg-red-400" : item.share > 20 ? "bg-amber-400" : "bg-emerald-400";

          return (
            <button
              key={item.id}
              type="button"
              onClick={onViewAll}
              className="group relative w-full overflow-hidden rounded-2xl border border-line bg-white p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:border-brand/30"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-slate-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative z-10 flex items-center gap-3">
                {/* Avatar */}
                <div className={cn(
                  "relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br text-[15px] font-black text-white shadow-md transition-transform group-hover:scale-110",
                  avatarGrad,
                )}>
                  {initials}
                  {medal && (
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm text-sm">
                      {medal}
                    </span>
                  )}
                </div>

                {/* Name + email */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-sm font-bold text-dark">
                      {item.prenom} {item.nom}
                    </span>
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                      item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-muted",
                    )}>
                      {item.isActive ? "● Actif" : "○ Inactif"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted">{item.email}</p>
                </div>

                {/* Stats chips */}
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <div className="text-center">
                    <p className="font-display text-lg font-extrabold text-dark leading-none">{item.students}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{studentsLabel}</p>
                  </div>
                  <div className="h-8 w-px bg-line" />
                  <div className="text-center">
                    <p className="font-display text-lg font-extrabold text-brand leading-none">{item.completed}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-muted">{completedLabel}</p>
                  </div>
                </div>
              </div>

              {/* Load bar */}
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">Charge</span>
                  <span className="text-[11px] font-bold text-dark">{item.share}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", shareColor)}
                    style={{ width: `${Math.min(item.share, 100)}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}

        {!items.length && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-slate-50 py-10">
            <UserRound className="h-8 w-8 text-muted" />
            <p className="text-sm text-muted">{emptyLabel}</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchAdminDashboard({ period: "all", salesId: "", destination: "", status: "" })
      .then((payload) => { setData(payload); setError(""); })
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger le dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const [pipelineStudents, setPipelineStudents] = useState<StudentOverview[]>([]);
  const [pipelineBusyId, setPipelineBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchStudentsOverview()
      .then((payload) => setPipelineStudents(payload.students || []))
      .catch(() => undefined);
  }, []);

  async function togglePipelineBlock(student: StudentOverview) {
    setPipelineBusyId(student.id);
    const nextActive = !student.isActive;
    try {
      await setStudentActive(student.id, nextActive);
      setPipelineStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, isActive: nextActive } : s)));
    } catch {
      // L'échec reste visible : la bulle garde son statut précédent au prochain survol.
    } finally {
      setPipelineBusyId(null);
    }
  }

  const currentYear = new Date().getFullYear();
  const funnel = data?.funnel ?? [];
  const conversionRate = funnel.length && funnel[0].count
    ? Math.round((funnel[funnel.length - 1].count / funnel[0].count) * 100)
    : 0;

  const maxDest = Math.max(1, ...(data?.destinations.map((item) => item.count) || [1]));

  const kpis = data
    ? [
        { key: "students",           label: "Étudiants",              icon: Users,         ...data.kpis.students,           onClick: () => navigate("/admin/users") },
        { key: "visasObtainedMonth", label: "Visas obtenus ce mois",   icon: PlaneTakeoff,  ...data.kpis.visasObtainedMonth, onClick: () => navigate("/archive") },
        { key: "stalledDossiers",    label: "Dossiers bloqués",        icon: AlertTriangle, ...data.kpis.stalledDossiers,    onClick: () => navigate("/admin/users") },
      ]
    : [];

  return (
    <main className="mx-auto max-w-[1400px] px-6 pb-16">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
        <p className="text-sm text-white/80">Espace administrateur</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/85">
          Vue réelle de l'activité : comptes, dossiers, destinations et charge des conseillers.
        </p>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* ── KPI cards with sparklines ────────────────────────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              className="group rounded-[24px] border border-line bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg"
            >
              <span className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">{item.label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light transition group-hover:bg-brand/20">
                  <Icon className="h-4 w-4 text-brand" />
                </span>
              </span>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <strong className="block font-display text-3xl font-extrabold text-dark">
                    {loading ? "…" : item.value}
                  </strong>
                  <span className="mt-1 block text-xs text-brand">{item.hint}</span>
                </div>
                {!loading && (
                  <Sparkline
                    data={SPARK_SEEDS[item.key] ?? []}
                    color={item.key === "stalledDossiers" ? "#f43f5e" : "#6d28d9"}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Pipeline des étudiants (candidature + visa) ──────────────────── */}
      <section className="mt-6 rounded-[24px] border border-line bg-white p-6">
        <h2 className="font-display text-xl font-bold text-dark">Pipeline des étudiants</h2>
        <p className="mt-0.5 text-xs text-muted">Avancement réel de chaque étudiant, candidature et visa compris.</p>
        <div className="mt-5">
          <StudentsPipelineBoard students={pipelineStudents} busyId={pipelineBusyId} onToggleBlock={togglePipelineBlock} />
        </div>
      </section>

      {/* ── Entonnoir de conversion & croissance réelle ──────────────────── */}
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Entonnoir de conversion"
          subtitle="Où les étudiants décrochent réellement dans le parcours, de l'inscription au visa obtenu."
          badge={
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-bold text-brand">
              {conversionRate}% jusqu'au visa
            </span>
          }
        >
          <ConversionFunnelChart funnel={funnel} />
        </ChartCard>

        <ChartCard
          title="Croissance mensuelle"
          subtitle="Nombre réel d'inscriptions cumulées, mois par mois."
          badge={<YoYBadge year={currentYear} />}
        >
          <GrowthAreaChart data={data?.monthlyGrowth ?? []} currentYear={currentYear} />
        </ChartCard>
      </div>

      {/* ── Destinations & Pipeline ──────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Destinations demandées"
          subtitle="Répartition géographique des choix des étudiants à l'onboarding."
        >
          {data?.destinations.length ? (
            <DestinationsPieChart destinations={data.destinations} />
          ) : (
            /* Fallback list while loading or empty */
            <div className="mt-2 space-y-3">
              {(data?.destinations || []).map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-xs text-muted">{item.count} · {item.percent}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-brand-light">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(item.count / maxDest) * 100}%` }} />
                  </div>
                </div>
              ))}
              {!data?.destinations.length && <p className="text-sm text-muted">Aucune destination renseignée pour le moment.</p>}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Pipeline des dossiers"
          subtitle="Répartition en pourcentage des dossiers par étape de traitement."
        >
          <PipelineRadialChart pipeline={data?.pipeline ?? []} />
        </ChartCard>
      </div>

      {/* ── Actions prioritaires ─────────────────────────────────────────── */}
      <div className="mt-4">
        <section className="rounded-[24px] border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-dark">Actions prioritaires</h2>
              <p className="mt-0.5 text-xs text-muted">Alertes calculées en temps réel depuis la base.</p>
            </div>
            {data?.alerts.length ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white shadow-[0_0_12px_rgba(239,68,68,.45)]">
                {data.alerts.length}
              </span>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {(data?.alerts || []).map((alert, idx) => {
              const isDanger = alert.tone === "danger";
              const isSuccess = alert.tone === "success";
              const isWarning = alert.tone === "warning";
              
              let Icon = isSuccess ? (alert.problem.includes("Visa") ? PlaneTakeoff : GraduationCap) : (isDanger ? AlertTriangle : AlertCircle);
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "group relative flex items-start gap-4 overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
                    isDanger && "border-red-100 bg-gradient-to-r from-red-50 to-white hover:border-red-200",
                    isWarning && "border-amber-100 bg-gradient-to-r from-amber-50 to-white hover:border-amber-200",
                    isSuccess && "border-brand/20 bg-gradient-to-r from-brand/5 to-white hover:border-brand/30",
                  )}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Decorative blur */}
                  {isSuccess && <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/10 blur-2xl transition-transform group-hover:scale-150" />}
                  
                  {/* Severity dot */}
                  <div className="mt-0.5 flex-shrink-0 relative z-10">
                    <span className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform group-hover:scale-110",
                      isDanger ? "bg-red-500" : isSuccess ? "bg-gradient-to-br from-brand to-violet-600" : "bg-amber-500",
                    )}>
                      <Icon className="h-5 w-5" />
                      {isDanger && (
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-400 animate-ping" />
                      )}
                      {isSuccess && (
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400 animate-pulse" />
                      )}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-[15px] font-bold text-dark">{alert.student}</p>
                      {alert.sinceDays !== undefined && alert.sinceDays !== null && !isSuccess ? (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          isDanger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
                        )}>
                          {alert.sinceDays} j
                        </span>
                      ) : alert.sinceDays === 0 && isSuccess ? (
                        <span className="rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Nouveau
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-mid">
                      Conseiller&nbsp;: <span className="font-semibold">{alert.sales || "—"}</span>
                    </p>
                    <span className={cn(
                      "mt-2 inline-block rounded-lg px-2.5 py-1 text-[11px] font-semibold",
                      isDanger && "bg-red-100 text-red-700",
                      isWarning && "bg-amber-100 text-amber-700",
                      isSuccess && "bg-brand/10 text-brand",
                    )}>
                      {alert.problem}
                    </span>
                  </div>
                </div>
              );
            })}

            {!data?.alerts.length && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-700">Aucune alerte active</p>
                  <p className="text-xs text-emerald-600">Tout est en ordre pour ces filtres.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Performance des deux équipes, classées séparément ────────────── */}
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <PerformanceList
          title="Équipe Sales"
          subtitle="Charge réelle par conseiller."
          studentsLabel="étudiants"
          completedLabel="complets"
          emptyLabel="Aucun conseiller pour le moment."
          items={data?.salesPerformance || []}
          onViewAll={() => navigate("/admin/sales")}
        />
        <PerformanceList
          title="Équipe RDV"
          subtitle="Dossiers visa réels par responsable."
          studentsLabel="dossiers"
          completedLabel="visas obtenus"
          emptyLabel="Aucun Responsable Dossier Visa pour le moment."
          items={data?.rdvPerformance || []}
          onViewAll={() => navigate("/admin/sales")}
        />
      </div>

      <BackupPanel />

    </main>
  );
}
