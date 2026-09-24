import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { AdminDashboard } from "@/lib/auth";

// ── Brand palette ──────────────────────────────────────────────────────────────
const BRAND = "#6d28d9";
const VIOLET_400 = "#a78bfa";
const VIOLET_300 = "#c4b5fd";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const SKY = "#0ea5e9";

const PIE_COLORS = [BRAND, VIOLET_400, VIOLET_300, SKY, EMERALD, AMBER, ROSE, "#8b5cf6"];

// ── Shared tooltip style ───────────────────────────────────────────────────────
const TooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "8px 12px",
  boxShadow: "0 4px 24px rgba(109,40,217,.10)",
  fontSize: 12,
};

// ─────────────────────────────────────────────────────────────────────────────
//  1. Pie chart – destinations
// ─────────────────────────────────────────────────────────────────────────────

interface DestinationsPieChartProps {
  destinations: AdminDashboard["destinations"];
}

function CustomPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function DestinationsPieChart({ destinations }: DestinationsPieChartProps) {
  if (!destinations.length)
    return <EmptyState label="Aucune destination renseignée pour le moment." />;

  const data = destinations.map((d) => ({ name: d.name, value: d.count }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {PIE_COLORS.map((color, i) => (
              <radialGradient key={i} id={`pie-grad-${i}`} cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
              </radialGradient>
            ))}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={115}
            paddingAngle={3}
            dataKey="value"
            labelLine={false}
            label={CustomPieLabel as unknown as React.ReactElement}
            strokeWidth={0}
          >
            {data.map((_, idx) => (
              <Cell
                key={idx}
                fill={`url(#pie-grad-${idx % PIE_COLORS.length})`}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TooltipStyle}
            formatter={(value, name) => [`${value} étudiant${Number(value) > 1 ? "s" : ""}`, name]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, color: "#64748b" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. Entonnoir de conversion réel (chaque étape ⊆ la précédente)
// ─────────────────────────────────────────────────────────────────────────────

const FUNNEL_COLORS = [BRAND, VIOLET_400, SKY, AMBER, EMERALD];

interface ConversionFunnelChartProps {
  funnel: AdminDashboard["funnel"];
}

export function ConversionFunnelChart({ funnel }: ConversionFunnelChartProps) {
  if (!funnel.length) return <EmptyState label="Aucune donnée de conversion." />;

  const reference = funnel[0]?.count || 1;

  return (
    <div className="space-y-4 py-1">
      {funnel.map((stage, i) => {
        const percent = reference ? Math.round((stage.count / reference) * 100) : 0;
        const previous = i > 0 ? funnel[i - 1] : null;
        const dropOff = previous && previous.count > 0 ? Math.round(((previous.count - stage.count) / previous.count) * 100) : null;
        const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
        return (
          <div key={stage.key}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-dark">{stage.label}</span>
              <span className="shrink-0 text-xs font-bold text-muted">
                {stage.count} <span className="text-mid">· {percent}%</span>
                {dropOff !== null && dropOff > 0 && (
                  <span className="ml-1.5 text-rose-500">−{dropOff}%</span>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. Area chart – student growth over months
// ─────────────────────────────────────────────────────────────────────────────

type GrowthPoint = { month: string; current: number; previous: number };

interface GrowthAreaChartProps {
  data: GrowthPoint[];
  currentYear?: number;
}

export function GrowthAreaChart({ data, currentYear = new Date().getFullYear() }: GrowthAreaChartProps) {
  const prevYear = currentYear - 1;

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="area-current" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
              <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="area-previous" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={VIOLET_400} stopOpacity={0.2} />
              <stop offset="100%" stopColor={VIOLET_400} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b", fontFamily: "inherit" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b", fontFamily: "inherit" }}
            width={36}
          />
          <Tooltip
            contentStyle={TooltipStyle}
            cursor={{ stroke: BRAND, strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {value === "current" ? String(currentYear) : String(prevYear)}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="previous"
            name="previous"
            stroke={VIOLET_400}
            strokeWidth={2}
            strokeDasharray="5 3"
            fill="url(#area-previous)"
            dot={false}
            activeDot={{ r: 4, fill: VIOLET_400, stroke: "white", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="current"
            name="current"
            stroke={BRAND}
            strokeWidth={2.5}
            fill="url(#area-current)"
            dot={false}
            activeDot={{ r: 5, fill: BRAND, stroke: "white", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. Radial bar chart – pipeline progress
// ─────────────────────────────────────────────────────────────────────────────

interface PipelineRadialChartProps {
  pipeline: AdminDashboard["pipeline"];
}

const PIPELINE_COLORS = [BRAND, EMERALD, AMBER, ROSE, SKY];

// Liste de barres horizontales plutôt qu'un radial à anneaux concentriques :
// le radial empilait 5 étapes qui ne sont PAS des parts d'un même tout
// (onboarding et affectation sont deux répartitions différentes du même
// total), ce qui rendait la lecture trompeuse. Ici chaque étape est une
// ligne indépendante avec son effectif et son % du total d'inscrits — un
// admin comprend d'un coup d'œil sans avoir à décoder une légende de couleurs.
export function PipelineRadialChart({ pipeline }: PipelineRadialChartProps) {
  if (!pipeline.length) return <EmptyState label="Aucune étape dans le pipeline." />;

  const reference = pipeline[0]?.count || Math.max(...pipeline.map((p) => p.count), 1);

  return (
    <div className="space-y-4 py-1">
      {pipeline.map((stage, i) => {
        const percent = reference ? Math.round((stage.count / reference) * 100) : 0;
        const color = PIPELINE_COLORS[i % PIPELINE_COLORS.length];
        return (
          <div key={stage.key}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-dark">{stage.label}</span>
              <span className="shrink-0 text-xs font-bold text-muted">
                {stage.count} <span className="text-mid">· {percent}%</span>
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. KPI trend sparkline (mini area)
// ─────────────────────────────────────────────────────────────────────────────

interface SparklineProps {
  data: number[];
  color?: string;
  className?: string;
}

export function Sparkline({ data, color = BRAND, className }: SparklineProps) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className={cn("h-10 w-24", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${color.replace("#", "")})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

