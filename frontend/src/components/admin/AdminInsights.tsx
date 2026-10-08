import { fetchAdminInsights, type AdminInsights } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  Clock,
  Coins,
  Eye,
  EyeOff,
  GraduationCap,
  Plane,
  Timer,
  UserPlus,
  UserX,
  Wallet
} from "lucide-react";
import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

// ── Briques d'animation ──────────────────────────────────────────────────────

// Compteur qui monte jusqu'à sa valeur quand la carte apparaît à l'écran.
function CountUp({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 1.1, ease: "easeOut", onUpdate: (v) => setShown(v) });
    return () => controls.stop();
  }, [inView, value]);

  return <span ref={ref}>{shown.toFixed(decimals)}{suffix}</span>;
}

// Anneau de progression : le trait se dessine à l'apparition.
function Ring({ percent, color, children }: { percent: number | null; color: string; children?: ReactNode }) {
  const size = 92;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - value / 100) }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

// Barre horizontale qui s'étire à l'apparition.
function Bar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <motion.div
        className={cn("h-full rounded-full", className)}
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}

function Delta({ current, previous, suffix = "", blur = "" }: { current: number; previous: number; suffix?: string; blur?: string }) {
  if (previous === 0 && current === 0) return <span className="text-[11px] text-muted">= période précédente</span>;
  const diff = current - previous;
  const up = diff >= 0;
  const text = previous === 0 ? `+${current}${suffix} (nouveau)` : `${up ? "+" : ""}${Math.round((diff / previous) * 100)}%`;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold", up ? "text-emerald-600" : "text-rose-500")}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      <span className={cn("transition", previous === 0 && blur)}>{text}</span>
    </span>
  );
}

function Card({ icon: Icon, title, tone, children, delay = 0, className }: { icon: typeof Clock; title: string; tone: string; children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className={cn("min-w-0 rounded-[24px] border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-lg", className)}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h3 className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </motion.article>
  );
}

const money = (value: number, currency: string) =>
  `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency === "EUR" ? "€" : currency === "TND" ? "DT" : currency}`;

// ── Section ──────────────────────────────────────────────────────────────────

export default function AdminInsightsSection() {
  const [data, setData] = useState<AdminInsights | null>(null);
  const [error, setError] = useState("");
  // Montants floutés par défaut (comme les commissions) ; re-floutés après 20 s.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetchAdminInsights()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Indicateurs indisponibles."));
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const blur = revealed ? "" : "select-none blur-[8px]";
  const eyeLabel = revealed ? "Masquer les montants" : "Afficher les montants";
  const { postponed, acceptance, visa, delays, finances, commissions, newStudents, withoutRdv } = data;
  const maxDelay = Math.max(delays.universityDays ?? 0, delays.visaDays ?? 0, 1);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-dark">Indicateurs clés</h2>
          <p className="mt-0.5 text-xs text-muted">Résultats réels : décisions, délais, finances et activité commerciale.</p>
        </div>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={eyeLabel}
          title={eyeLabel}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-mid transition hover:border-brand hover:text-brand"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {revealed ? "Masquer les montants" : "Afficher les montants"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Nouveaux étudiants */}
        <Card icon={UserPlus} title="Nouveaux étudiants" tone="bg-violet-100 text-brand">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-4xl font-extrabold leading-none text-dark"><CountUp value={newStudents.thisWeek} /></p>
              <p className="mt-1 text-[11px] text-muted">cette semaine</p>
            </div>
            <Delta current={newStudents.thisWeek} previous={newStudents.lastWeek} />
          </div>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3">
            <div>
              <p className="font-display text-2xl font-extrabold leading-none text-dark"><CountUp value={newStudents.thisMonth} /></p>
              <p className="mt-1 text-[11px] text-muted">ce mois-ci</p>
            </div>
            <Delta current={newStudents.thisMonth} previous={newStudents.lastMonth} />
          </div>
        </Card>

        {/* Taux d'acceptation */}
        <Card icon={GraduationCap} title="Acceptation universités" tone="bg-emerald-100 text-emerald-600" delay={0.06}>
          <div className="flex items-center gap-4">
            <Ring percent={acceptance.rate} color="#10b981">
              <span className="font-display text-xl font-extrabold text-dark">
                {acceptance.rate === null ? "–" : <CountUp value={acceptance.rate} suffix="%" />}
              </span>
            </Ring>
            <div className="min-w-0 text-xs text-muted">
              <p><strong className="text-emerald-600">{acceptance.accepted}</strong> acceptées</p>
              <p><strong className="text-rose-500">{acceptance.rejected}</strong> refusées</p>
              <p className="mt-1 text-[11px]">{acceptance.decided} décision{acceptance.decided > 1 ? "s" : ""}</p>
            </div>
          </div>
          {acceptance.byCountry.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {acceptance.byCountry.slice(0, 4).map((row) => (
                <div key={row.country}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="truncate font-semibold text-dark">{row.country}</span>
                    <span className="shrink-0 text-muted">{row.rate}% · {row.decided}</span>
                  </div>
                  <Bar percent={row.rate ?? 0} className="bg-emerald-500" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Taux de visa */}
        <Card icon={Plane} title="Obtention du visa" tone="bg-sky-100 text-sky-600" delay={0.12}>
          <div className="flex items-center gap-4">
            <Ring percent={visa.rate} color="#0ea5e9">
              <span className="font-display text-xl font-extrabold text-dark">
                {visa.rate === null ? "–" : <CountUp value={visa.rate} suffix="%" />}
              </span>
            </Ring>
            <div className="min-w-0 text-xs text-muted">
              <p><strong className="text-sky-600">{visa.obtained}</strong> obtenus</p>
              <p><strong className="text-rose-500">{visa.rejected}</strong> refusés</p>
              <p className="mt-1 text-[11px]">{visa.pending} en attente de décision</p>
            </div>
          </div>
        </Card>

        {/* Dossiers reportés */}
        <Card icon={CalendarClock} title="Dossiers reportés" tone="bg-orange-100 text-orange-600" delay={0.18}>
          <p className="font-display text-4xl font-extrabold leading-none text-dark"><CountUp value={postponed.total} /></p>
          <p className="mt-1 text-[11px] text-muted">refus à retenter plus tard</p>
          <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
            <p className="flex items-center justify-between">
              <span className="text-muted">Date dans les 30 jours</span>
              <strong className={cn(postponed.due30 > 0 ? "text-orange-600" : "text-dark")}>{postponed.due30}</strong>
            </p>
            <p className="flex items-center justify-between"><span className="text-muted">Candidatures</span><strong className="text-dark">{postponed.application}</strong></p>
            <p className="flex items-center justify-between"><span className="text-muted">Visas</span><strong className="text-dark">{postponed.visa}</strong></p>
          </div>
        </Card>

        {/* Délais moyens */}
        <Card icon={Timer} title="Délais moyens" tone="bg-amber-100 text-amber-600">
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-dark">Réponse de l'université</span>
                <span className="font-display text-xl font-extrabold text-dark">
                  {delays.universityDays === null ? "–" : <CountUp value={delays.universityDays} decimals={1} suffix=" j" />}
                </span>
              </div>
              <Bar percent={delays.universityDays === null ? 0 : (delays.universityDays / maxDelay) * 100} className="bg-amber-400" />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-dark">Décision du visa</span>
                <span className="font-display text-xl font-extrabold text-dark">
                  {delays.visaDays === null ? "–" : <CountUp value={delays.visaDays} decimals={1} suffix=" j" />}
                </span>
              </div>
              <Bar percent={delays.visaDays === null ? 0 : (delays.visaDays / maxDelay) * 100} className="bg-sky-400" />
            </div>
            <p className="text-[11px] text-muted">Du dépôt à la décision, sur les dossiers déjà tranchés.</p>
          </div>
        </Card>

        {/* Chiffre d'affaires */}
        <Card icon={Wallet} title="Encaissements" tone="bg-emerald-100 text-emerald-600" delay={0.06}>
          {finances.perCurrency.length === 0 ? (
            <p className="text-xs text-muted">Aucun paiement enregistré pour l'instant.</p>
          ) : (
            <div className="space-y-4">
              {finances.perCurrency.map((row) => (
                <div key={row.currency}>
                  <div className="flex items-end justify-between gap-2">
                    <p className={cn("font-display text-2xl font-extrabold leading-none text-dark transition", blur)}>{money(row.thisMonth, row.currency)}</p>
                    <Delta current={row.thisMonth} previous={row.lastMonth} blur={blur} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">encaissés ce mois-ci</p>
                  <p className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted">Reste à encaisser</span>
                    <strong className={cn("text-amber-600 transition", blur)}>{money(row.outstanding, row.currency)}</strong>
                  </p>
                </div>
              ))}
              <p className="flex items-center justify-between border-t border-line pt-3 text-xs">
                <span className="flex items-center gap-1.5 text-muted"><Banknote className="h-3.5 w-3.5" /> Visas bloqués par un paiement</span>
                <strong className={cn(finances.visaBlocked > 0 ? "text-rose-500" : "text-dark")}>{finances.visaBlocked}</strong>
              </p>
            </div>
          )}
        </Card>

        {/* Commissions */}
        <Card icon={Coins} title="Commissions du mois" tone="bg-violet-100 text-brand" delay={0.12}>
          <div className="flex items-end justify-between gap-2">
            <p className={cn("font-display text-3xl font-extrabold leading-none text-dark transition", blur)}>{money(commissions.totalThisMonth, "TND")}</p>
            <Delta current={commissions.totalThisMonth} previous={commissions.totalLastMonth} blur={blur} />
          </div>
          <p className="mt-1 text-[11px] text-muted">coût commercial du mois</p>
          {(commissions.dueTotal ?? 0) > 0 && (
            <Link to="/admin/finance?tab=versements" className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100">
              À verser : <span className={cn("transition", blur)}>{money(commissions.dueTotal ?? 0, "TND")}</span> →
            </Link>
          )}
          <div className="mt-4 space-y-3 border-t border-line pt-3">
            {[
              { label: "Équipe Conseillers", value: commissions.salesThisMonth, color: "bg-violet-500" },
              { label: "Équipe Responsables Dossier", value: commissions.rdvThisMonth, color: "bg-sky-500" }
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-dark">{row.label}</span>
                  <span className={cn("text-muted transition", blur)}>{money(row.value, "TND")}</span>
                </div>
                <Bar percent={commissions.totalThisMonth > 0 ? (row.value / commissions.totalThisMonth) * 100 : 0} className={row.color} />
              </div>
            ))}
          </div>
        </Card>

        {/* Dossiers sans RDV */}
        <Card icon={UserX} title="Acceptés sans Responsable Dossier" tone={withoutRdv > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"} delay={0.18}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <p className={cn("font-display text-5xl font-extrabold leading-none", withoutRdv > 0 ? "text-rose-500" : "text-emerald-600")}>
                <CountUp value={withoutRdv} />
              </p>
              <p className="max-w-xs text-xs text-muted">
                {withoutRdv > 0
                  ? "dossiers acceptés par une université mais sans responsable visa : personne ne peut les suivre."
                  : "Tous les dossiers acceptés ont un responsable visa."}
              </p>
            </div>
            {withoutRdv > 0 && (
              <Link to="/admin/users?tab=rdv&focus=attribution-visa" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white transition hover:opacity-90">
                <Clock className="h-3.5 w-3.5" /> Attribuer un Responsable Dossier
              </Link>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}
