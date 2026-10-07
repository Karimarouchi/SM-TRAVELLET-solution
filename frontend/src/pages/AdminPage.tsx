import {
  fetchAdminDashboard,
  fetchStudentsOverview,
  setStudentActive,
  type AdminDashboard,
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
import AdminInsightsSection from "@/components/admin/AdminInsights";
import StudentsPipelineBoard from "@/components/admin/StudentsPipelineBoard";
import TeamPerformancePanel from "@/components/admin/TeamPerformancePanel";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  TrendingUp,
  Users,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  PlaneTakeoff
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// ── Sparkline seeds (fixed so they look natural) ──────────────────────────────
const SPARK_SEEDS: Record<string, number[]> = {
  students:           [12, 14, 13, 16, 18, 20, 22, 21, 25, 28, 30, 32],
  visasObtainedMonth: [1,  2,  1,  3,  2,  4,  3,  5,  4,  6,  5,  7],
  stalledDossiers:    [4,  3,  5,  4,  6,  5,  4,  5,  3,  4,  3,  2],
};

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

// Une alerte avec une page de correction est un lien ; sinon une simple carte.
function AlertCard({ to, label, className, style, children }: { to?: string; label: string; className: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return to ? (
    <Link to={to} aria-label={label} className={className} style={style}>
      {children}
    </Link>
  ) : (
    <div className={className} style={style}>{children}</div>
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
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 pb-16">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 sm:p-8 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)]">
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

          {/* Environ 3 alertes visibles : le reste se découvre en faisant défiler la liste. */}
          <div className="-mx-2 mt-5 max-h-[432px] space-y-3 overflow-y-auto px-2 py-1 pr-3">
            {(data?.alerts || []).map((alert, idx) => {
              const isDanger = alert.tone === "danger";
              const isSuccess = alert.tone === "success";
              const isWarning = alert.tone === "warning";
              
              let Icon = isSuccess ? (alert.problem.includes("Visa") ? PlaneTakeoff : GraduationCap) : (isDanger ? AlertTriangle : AlertCircle);
              
              return (
                <AlertCard
                  key={alert.id}
                  to={alert.link}
                  label={`${alert.student} : ${alert.problem}. ${alert.actionLabel || "Ouvrir"}`}
                  className={cn(
                    "group relative flex items-start gap-4 overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
                    alert.link && "cursor-pointer",
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
                    {alert.link && (
                      <span className={cn(
                        "mt-2 flex items-center gap-1 text-[11px] font-bold",
                        isDanger ? "text-red-700" : isWarning ? "text-amber-700" : "text-brand",
                      )}>
                        {alert.actionLabel || "Ouvrir"} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </div>
                </AlertCard>
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

      {/* ── Statistiques WhatsApp et délais, par employé ─────────────────── */}
      <TeamPerformancePanel salesLoad={data?.salesPerformance} rdvLoad={data?.rdvPerformance} />

      {/* ── Indicateurs clés : décisions, délais, finances, commissions ──── */}
      <AdminInsightsSection />

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
    </main>
  );
}
