import type { PerfWorkHours, StaffDetail, StaffEvent } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, FileCheck2, Gauge, MessageCircle, Plane, Send, Timer, Users, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CountUp } from "./anim";

type MetricKey = keyof StaffDetail;
type Metric = { key: MetricKey; label: string; icon: typeof Clock; from: string; to: string; color: string };

const SALES_METRICS: Metric[] = [
  { key: "reply", label: "Réponses aux étudiants", icon: MessageCircle, from: "Message de l'étudiant", to: "Réponse du conseiller", color: "#10b981" },
  { key: "review", label: "Validation des documents", icon: FileCheck2, from: "Document déposé", to: "Document vérifié", color: "#8b5cf6" },
  { key: "handoff", label: "Dossier → RDV", icon: Send, from: "Inscription", to: "Transmis au RDV", color: "#0ea5e9" },
  { key: "visaDocs", label: "Acceptation → docs visa", icon: Plane, from: "Candidature acceptée", to: "Documents visa validés", color: "#f59e0b" }
];

const RDV_METRICS: Metric[] = [
  { key: "readyToApplied", label: "Dépôt de la candidature", icon: Send, from: "Documents validés", to: "Candidature déposée", color: "#8b5cf6" },
  { key: "appliedToDecision", label: "Réponse de l'université", icon: CalendarClock, from: "Candidature déposée", to: "Décision de l'université", color: "#10b981" },
  { key: "visaDocsToSubmit", label: "Dépôt du visa", icon: Plane, from: "Documents visa validés", to: "Visa déposé", color: "#0ea5e9" },
  { key: "visaDecision", label: "Décision du visa", icon: Timer, from: "Visa déposé", to: "Décision du visa", color: "#f59e0b" }
];

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const OUTCOMES: Record<string, { label: string; tone: string }> = {
  VALIDATED: { label: "Validé", tone: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Refusé", tone: "bg-rose-50 text-rose-600" },
  ACCEPTED: { label: "Accepté", tone: "bg-emerald-50 text-emerald-700" }
};

// Même format que le serveur : « 53 min », « 2 h », « 110 h 7 min ».
function fmt(minutes: number | null) {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}

function toMinutes(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Summary = { count: number; avg: number | null; median: number | null; min: number | null; max: number | null; total: number };

function summarize(events: StaffEvent[]): Summary {
  const values = events.map((e) => e.minutes);
  const total = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: values.length ? total / values.length : null,
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    total
  };
}

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function speedTone(minutes: number, avg: number | null) {
  if (!avg) return { bar: "bg-slate-300", text: "text-dark" };
  const ratio = minutes / avg;
  if (ratio <= 0.5) return { bar: "bg-emerald-500", text: "text-emerald-700" };
  if (ratio <= 1.25) return { bar: "bg-sky-500", text: "text-sky-700" };
  if (ratio <= 2) return { bar: "bg-amber-500", text: "text-amber-700" };
  return { bar: "bg-rose-500", text: "text-rose-600" };
}

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: typeof Clock; label: string; value: string; hint?: string; tone: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-4 w-4" aria-hidden /></span>
        <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-3 break-words font-display text-2xl font-extrabold leading-tight text-dark">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </motion.div>
  );
}

export default function StaffTimeDetail({ detail, kind, workHours }: { detail: StaffDetail; kind: "sales" | "rdv"; workHours: PerfWorkHours }) {
  const metrics = kind === "sales" ? SALES_METRICS : RDV_METRICS;
  const now = new Date();
  const dayMinutes = Math.max(60, toMinutes(workHours.end) - toMinutes(workHours.start));
  // Premier onglet qui contient des cas (sinon le premier).
  const [metricKey, setMetricKey] = useState<MetricKey>((metrics.find((m) => (detail[m.key] || []).length) || metrics[0]).key);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(0);
  const [view, setView] = useState<"cases" | "students">("cases");

  const metric = metrics.find((m) => m.key === metricKey) || metrics[0];
  const all = detail[metric.key] || [];

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    for (const m of metrics) for (const e of detail[m.key] || []) set.add(new Date(e.to).getFullYear());
    return [...set].sort((a, b) => a - b);
  }, [detail, metrics]);

  const prefix = month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const events = useMemo(() => all.filter((e) => monthKey(e.to).startsWith(prefix)), [all, prefix]);
  const summary = summarize(events);
  const periodLabel = month ? `${MONTHS[month - 1]} ${year}` : `Année ${year}`;

  const monthRows = useMemo(
    () => MONTHS.map((_, i) => ({ index: i + 1, ...summarize(all.filter((e) => monthKey(e.to) === `${year}-${String(i + 1).padStart(2, "0")}`)) })),
    [all, year]
  );
  const yearSummary = summarize(all.filter((e) => monthKey(e.to).startsWith(String(year))));
  const chartMax = Math.max(...monthRows.map((r) => r.avg ?? 0), 1);

  const students = useMemo(() => {
    const map = new Map<string, StaffEvent[]>();
    for (const e of events) map.set(e.student, [...(map.get(e.student) || []), e]);
    return [...map.entries()].map(([name, list]) => ({ name, ...summarize(list) })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [events]);

  const days = (minutes: number | null) => (minutes !== null && minutes >= dayMinutes ? `≈ ${(minutes / dayMinutes).toFixed(1).replace(".0", "")} j de travail` : undefined);
  const maxCase = summary.max || 1;
  const maxStudentAvg = Math.max(...students.map((s) => s.avg ?? 0), 1);

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-line bg-white shadow-sm">
      <div className="bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-5 text-white sm:p-7">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/75"><Gauge className="h-3.5 w-3.5" aria-hidden /> Temps de travail en détail</p>
        <h2 className="mt-1 font-display text-2xl font-extrabold">Combien de temps pour chaque tâche ?</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/80">
          Chaque cas, étudiant par étudiant, puis les totaux par mois et par année. Durées mesurées en heures de travail ({workHours.start}–{workHours.end}).
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {metrics.map((m) => {
            const Icon = m.icon;
            const count = (detail[m.key] || []).filter((e) => monthKey(e.to).startsWith(prefix)).length;
            const active = m.key === metric.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetricKey(m.key)}
                aria-pressed={active}
                className={cn("flex min-w-0 items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition", active ? "border-white bg-white text-brand shadow-lg" : "border-white/20 bg-white/10 text-white hover:bg-white/15")}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold">{m.label}</span>
                  <span className={cn("block text-[11px]", active ? "text-muted" : "text-white/70")}>{count} cas</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Période */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setMonth(0)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition", month === 0 ? "border-brand bg-brand text-white" : "border-line text-mid hover:border-brand hover:text-brand")}>Toute l'année</button>
            {SHORT.map((label, i) => (
              <button key={label} type="button" onClick={() => setMonth(i + 1)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition", month === i + 1 ? "border-brand bg-brand text-white" : monthRows[i].count ? "border-line text-dark hover:border-brand hover:text-brand" : "border-line/60 text-muted/70 hover:border-brand hover:text-brand")}>{label}</button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-line bg-slate-50 px-1 py-0.5">
            <button type="button" aria-label="Année précédente" disabled={year <= years[0]} onClick={() => setYear(year - 1)} className="rounded-full p-1.5 text-mid transition hover:bg-white hover:text-brand disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[3.5rem] text-center font-display text-sm font-bold text-dark">{year}</span>
            <button type="button" aria-label="Année suivante" disabled={year >= years[years.length - 1]} onClick={() => setYear(year + 1)} className="rounded-full p-1.5 text-mid transition hover:bg-white hover:text-brand disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">{metric.label} · {periodLabel}</p>
        <p className="mt-0.5 text-xs text-muted">Du « {metric.from} » au « {metric.to} ».</p>

        {/* KPI */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Users} label="Nombre de cas" value={String(summary.count)} hint={summary.count ? "sur la période" : "aucun cas"} tone="bg-violet-100 text-brand" />
          <Kpi icon={Gauge} label="Temps moyen" value={fmt(summary.avg)} hint={days(summary.avg)} tone="bg-sky-100 text-sky-600" />
          <Kpi icon={Timer} label="Temps médian" value={fmt(summary.median)} hint={days(summary.median)} tone="bg-indigo-100 text-indigo-600" />
          <Kpi icon={Zap} label="Le plus rapide" value={fmt(summary.min)} tone="bg-emerald-100 text-emerald-600" />
          <Kpi icon={Clock} label="Le plus long" value={fmt(summary.max)} hint={days(summary.max)} tone="bg-rose-100 text-rose-500" />
          <Kpi icon={CalendarClock} label="Temps cumulé" value={fmt(summary.total)} hint={days(summary.total)} tone="bg-amber-100 text-amber-600" />
        </div>

        {/* Graphique mensuel */}
        <div className="mt-6 rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-dark">Temps moyen mois par mois · {year}</h3>
            <span className="text-[11px] text-muted">moyenne de l'année : <strong className="text-dark">{fmt(yearSummary.avg)}</strong></span>
          </div>
          <div className="mt-4 flex h-44 items-end gap-1.5 sm:gap-3">
            {monthRows.map((row, i) => {
              const selected = month === row.index;
              return (
                <button key={row.index} type="button" onClick={() => setMonth(selected ? 0 : row.index)} title={`${MONTHS[i]} : ${fmt(row.avg)} en moyenne · ${row.count} cas`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className={cn("hidden text-[10px] font-bold sm:block", selected ? "text-brand" : "text-muted opacity-0 transition group-hover:opacity-100")}>{row.count ? fmt(row.avg) : ""}</span>
                  <div className="flex h-full w-full items-end justify-center">
                    <motion.div
                      key={`${metric.key}-${year}-${row.avg}`}
                      className={cn("w-3/4 rounded-t-md transition-colors", selected ? "opacity-100" : "opacity-60 group-hover:opacity-100")}
                      style={{ backgroundColor: metric.color }}
                      initial={{ height: 0 }}
                      animate={{ height: `${row.avg ? Math.max(4, (row.avg / chartMax) * 100) : 0}%` }}
                      transition={{ duration: 0.7, delay: i * 0.03, ease: "easeOut" }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-bold", selected ? "text-brand" : "text-muted")}>{SHORT[i]}</span>
                  <span className="text-[9px] text-muted/80">{row.count || ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cas par cas / par étudiant */}
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-dark">{view === "cases" ? "Chaque cas" : "Par étudiant"} · {periodLabel}</h3>
            <div className="inline-flex rounded-full border border-line bg-slate-50 p-0.5">
              {([["cases", "Cas par cas"], ["students", "Par étudiant"]] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setView(id)} className={cn("rounded-full px-3 py-1 text-xs font-bold transition", view === id ? "bg-brand text-white" : "text-mid hover:text-brand")}>{label}</button>
              ))}
            </div>
          </div>

          {events.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Aucun cas sur cette période.</p>
          ) : view === "cases" ? (
            <div className="mt-3 max-h-[480px] overflow-auto rounded-2xl border border-line">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-[10px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Étudiant</th>
                    <th className="px-3 py-2.5">Détail</th>
                    <th className="px-3 py-2.5">Début → fin</th>
                    <th className="w-56 px-3 py-2.5">Durée</th>
                    <th className="px-3 py-2.5">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {events.map((e, i) => {
                    const tone = speedTone(e.minutes, summary.avg);
                    const outcome = e.outcome ? OUTCOMES[e.outcome] : null;
                    return (
                      <tr key={`${e.student}-${e.to}-${i}`} className="transition hover:bg-brand/5">
                        <td className="whitespace-nowrap px-4 py-2.5 text-mid">{new Date(e.to).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="px-3 py-2.5 font-semibold text-dark">{e.student}</td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-muted">{e.sub}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                          {new Date(e.from).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} → {new Date(e.to).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className={cn("w-24 shrink-0 font-bold", tone.text)}>{fmt(e.minutes)}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                              <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.max(3, (e.minutes / maxCase) * 100)}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">{outcome ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", outcome.tone)}>{e.outcome === "ACCEPTED" && metric.key === "visaDecision" ? "Visa obtenu" : outcome.label}</span> : <span className="text-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {students.map((s, i) => {
                const tone = speedTone(s.avg ?? 0, summary.avg);
                return (
                  <motion.div key={s.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03 }} className="rounded-2xl border border-line p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-bold text-dark">{s.name}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-muted">{s.count} cas</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3 text-xs">
                      <span className="text-muted">Moyenne <strong className={cn("text-sm", tone.text)}>{fmt(s.avg)}</strong></span>
                      <span className="text-muted">Total <strong className="text-sm text-dark">{fmt(s.total)}</strong></span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div className={cn("h-full rounded-full", tone.bar)} initial={{ width: 0 }} animate={{ width: `${Math.max(4, ((s.avg ?? 0) / maxStudentAvg) * 100)}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted">le plus rapide {fmt(s.min)} · le plus long {fmt(s.max)}</p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tableau mensuel */}
        <div className="mt-6">
          <h3 className="font-display text-base font-bold text-dark">Totaux par mois · {year}</h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Mois</th>
                  <th className="px-3 py-2.5 text-right">Cas</th>
                  <th className="px-3 py-2.5 text-right">Temps moyen</th>
                  <th className="px-3 py-2.5 text-right">Le plus rapide</th>
                  <th className="px-3 py-2.5 text-right">Le plus long</th>
                  <th className="px-3 py-2.5 text-right">Temps cumulé</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row, i) => (
                  <tr key={row.index} onClick={() => setMonth(month === row.index ? 0 : row.index)} className={cn("cursor-pointer border-t border-line/50 transition hover:bg-slate-50", month === row.index && "bg-brand/5")}>
                    <td className="px-4 py-2 font-semibold text-dark">{MONTHS[i]}</td>
                    <td className="px-3 py-2 text-right text-mid">{row.count}</td>
                    <td className="px-3 py-2 text-right font-bold text-dark">{fmt(row.avg)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{fmt(row.min)}</td>
                    <td className="px-3 py-2 text-right text-rose-600">{fmt(row.max)}</td>
                    <td className="px-3 py-2 text-right text-mid">{row.count ? fmt(row.total) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line font-bold text-dark">
                  <td className="px-4 py-2.5">Total {year}</td>
                  <td className="px-3 py-2.5 text-right"><CountUp value={yearSummary.count} /></td>
                  <td className="px-3 py-2.5 text-right">{fmt(yearSummary.avg)}</td>
                  <td className="px-3 py-2.5 text-right text-emerald-700">{fmt(yearSummary.min)}</td>
                  <td className="px-3 py-2.5 text-right text-rose-600">{fmt(yearSummary.max)}</td>
                  <td className="px-3 py-2.5 text-right">{yearSummary.count ? fmt(yearSummary.total) : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
