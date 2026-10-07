import { fetchTeamPerformance, type PerformancePeriod, type StaffPerformance, type TeamPerformance } from "@/lib/auth";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { AlertTriangle, BarChart3, Clock, Crown, Flame, MessageCircle, Send, Sparkles, Timer, TrendingUp, UserCheck, Users } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CountUp, Ring } from "./anim";
import PendingConversationsList from "./PendingConversationsList";
import { PERIOD_OPTIONS, StatusChip, WorkHoursNote } from "./performance-ui";

// ── Bandeau : un indicateur « verre » ────────────────────────────────────────
function GlassStat({ icon: Icon, label, hint, children, onClick, active, warn }: { icon: typeof Clock; label: string; hint?: ReactNode; children: ReactNode; onClick?: () => void; active?: boolean; warn?: boolean }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="min-w-0">
      <Wrapper
        {...(onClick ? { type: "button" as const, onClick, "aria-expanded": active } : {})}
        className={cn(
          "relative h-full w-full min-w-0 overflow-hidden rounded-2xl border bg-white/10 p-4 text-left text-white backdrop-blur-md transition",
          warn ? "border-amber-300/60" : "border-white/20",
          onClick && "cursor-pointer hover:bg-white/15",
          active && "ring-2 ring-amber-300"
        )}
      >
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white/75">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", warn && "text-amber-300")} aria-hidden />
          <span className="truncate">{label}</span>
        </p>
        <div className="mt-2 font-display text-3xl font-extrabold leading-none">{children}</div>
        {hint ? <p className="mt-1.5 text-[11px] leading-snug text-white/70">{hint}</p> : null}
        {onClick && <p className="mt-1.5 text-[11px] font-bold text-amber-200">{active ? "Masquer la liste ▲" : "Voir la liste ▼"}</p>}
      </Wrapper>
    </motion.div>
  );
}

const DAY_SHORT = ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// « Lun–Ven » pour des jours consécutifs, sinon la liste.
function workDaysLabel(days: number[]) {
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.length > 2 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  return consecutive ? `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}` : sorted.map((d) => DAY_SHORT[d]).join(" · ");
}

// Valeur de durée : « 53 min » → compteur sur le nombre, unité conservée.
function DurationValue({ label }: { label: string }) {
  const match = label.match(/^(\d+)\s*(.*)$/);
  if (!match) return <span>{label}</span>;
  return (
    <span>
      <CountUp value={Number(match[1])} />
      <span className="ml-1 text-base font-bold text-white/80">{match[2]}</span>
    </span>
  );
}

// ── Entonnoir WhatsApp en forme d'entonnoir ──────────────────────────────────
const FUNNEL_COLORS = ["from-violet-500 to-violet-400", "from-violet-500 to-fuchsia-400", "from-fuchsia-500 to-pink-400", "from-pink-500 to-rose-400", "from-emerald-500 to-emerald-400"];

function Funnel({ wa }: { wa: TeamPerformance["whatsapp"] }) {
  const total = wa.conversations;
  const rows = [
    { label: "Conversations", value: wa.conversations, hint: "le contact a écrit sur la période" },
    { label: "Répondues", value: wa.answered, hint: "le conseiller a parlé avec le contact" },
    { label: "Code envoyé", value: wa.codeSent, hint: "parmi les répondues" },
    { label: "Inscrits", value: wa.registered, hint: "parmi les répondues" },
    { label: "Abouties", value: wa.converted, hint: "code envoyé ou inscrit" }
  ];
  return (
    <div className="space-y-2">
      {rows.map((row, i) => {
        const share = total ? Math.round((row.value / total) * 100) : 0;
        const previous = i > 0 ? rows[i - 1].value : 0;
        const drop = i > 0 && previous > 0 ? Math.round(((previous - row.value) / previous) * 100) : null;
        return (
          <div key={row.label} title={`${row.label} : ${row.value} (${share} % des conversations) — ${row.hint}`} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-semibold text-dark">{row.label}</span>
            <div className="flex min-w-0 flex-1 justify-center">
              <motion.div
                className={cn("flex h-9 items-center justify-center rounded-xl bg-gradient-to-r px-3 text-sm font-extrabold text-white shadow-sm", FUNNEL_COLORS[i])}
                initial={{ width: "8%" }}
                whileInView={{ width: `${Math.max(share, 10)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.1, ease: "easeOut" }}
              >
                {row.value}
              </motion.div>
            </div>
            <span className={cn("w-14 shrink-0 text-right text-[11px] font-bold", drop === null ? "text-muted" : drop > 50 ? "text-rose-500" : "text-muted")}>
              {drop === null ? `${share} %` : `−${drop} %`}
            </span>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 pt-2">
        <StatusChip count={wa.unanswered} label="sans réponse" />
        <StatusChip count={wa.notConverted} label={wa.notConverted > 1 ? "répondues mais non abouties" : "répondue mais non aboutie"} />
      </div>
    </div>
  );
}

// Charge de travail (part des dossiers de l'équipe) et dossiers terminés, issues du dashboard.
type Load = { id: string; share: number; completed: number };

function LoadBar({ load }: { load?: Load }) {
  if (!load) return null;
  const color = load.share > 35 ? "from-rose-500 to-rose-400" : load.share > 20 ? "from-amber-500 to-amber-400" : "from-emerald-500 to-emerald-400";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-dark">Charge de travail</span>
        <span className="font-bold text-dark">{load.share}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", color)}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(load.share ? 3 : 0, Math.min(load.share, 100))}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ── Cartes employés ──────────────────────────────────────────────────────────
function MiniStat({ icon: Icon, label, value, warn }: { icon: typeof Clock; label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-xl px-3 py-2", warn ? "bg-amber-50" : "bg-slate-50")}>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        <Icon className={cn("h-3 w-3 shrink-0", warn ? "text-amber-500" : "text-muted")} aria-hidden />
        <span className="truncate">{label}</span>
      </p>
      <p className={cn("mt-0.5 truncate text-sm font-extrabold", warn ? "text-amber-700" : "text-dark")}>{value}</p>
    </div>
  );
}

function PersonShell({ person, rank, period, index, accent, children, footer }: { person: StaffPerformance; rank: number | null; period: PerformancePeriod; index: number; accent: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.45, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className={cn("group relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-line bg-white p-5 shadow-sm transition-shadow hover:shadow-xl", !person.isActive && "opacity-60")}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accent)} />
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <UserAvatar name={`${person.prenom} ${person.nom}`} size="lg" className="h-11 w-11 text-xs" />
          {rank === 1 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white shadow">
              <Crown className="h-3 w-3" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold text-dark">{person.prenom} {person.nom}</p>
          <p className="truncate text-[11px] text-muted">{person.isActive ? person.email : "Compte inactif"}</p>
        </div>
        {rank !== null && rank <= 3 && (
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold", rank === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>#{rank}</span>
        )}
      </div>
      <div className="mt-4 flex-1">{children}</div>
      {footer ? <div className="mt-4 border-t border-line pt-3">{footer}</div> : null}
      <Link
        to={`/admin/equipe/${person.id}?period=${period}`}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand/10 px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand hover:text-white"
      >
        <BarChart3 className="h-3.5 w-3.5" /> Voir toutes les stats
      </Link>
    </motion.article>
  );
}

function SalesCard({ person, rank, period, index, load }: { person: StaffPerformance; rank: number | null; period: PerformancePeriod; index: number; load?: Load }) {
  const s = person.sales!;
  const wa = s.whatsapp;
  return (
    <PersonShell
      person={person}
      rank={rank}
      period={period}
      index={index}
      accent="from-violet-500 to-fuchsia-400"
      footer={
        <div className="space-y-3">
          <LoadBar load={load} />
          <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="font-semibold text-dark">Codes d'inscription</span>
            <span className="text-muted">{s.codes.used} utilisé{s.codes.used > 1 ? "s" : ""} / {s.codes.created} créé{s.codes.created > 1 ? "s" : ""}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
              initial={{ width: 0 }}
              whileInView={{ width: `${s.codes.created ? Math.max(4, (s.codes.used / s.codes.created) * 100) : 0}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <Ring percent={wa.conversionRate} color="#8b5cf6" size={84} stroke={8}>
          <span className="text-center font-display text-lg font-extrabold leading-none text-dark">
            {wa.conversionRate === null ? "—" : <CountUp value={wa.conversionRate} suffix="%" />}
            <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-wide text-muted">abouties</span>
          </span>
        </Ring>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <div>
            <p className="font-display text-3xl font-extrabold leading-none text-dark"><CountUp value={wa.conversations} /></p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">conversations</p>
          </div>
          <div>
            <p className="font-display text-3xl font-extrabold leading-none text-dark"><CountUp value={s.students} /></p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">étudiants</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat icon={Timer} label="Temps de réponse" value={wa.reply.label} />
        <MiniStat icon={Clock} label="En attente" value={wa.pendingNow} warn={wa.pendingNow > 0} />
        <MiniStat icon={UserCheck} label="Vérif. docs" value={s.documentReview.label} />
        <MiniStat icon={Send} label="Dossier → RDV" value={s.handoff.label} />
        <MiniStat icon={Flame} label="Mi-parcours" value={s.halfwayDossiers} warn={s.halfwayDossiers > 0} />
        <MiniStat icon={TrendingUp} label="Docs validés" value={s.documentsValidated} />
        <MiniStat icon={Crown} label="Dossiers complets" value={load ? load.completed : "—"} />
      </div>
    </PersonShell>
  );
}

function RdvCard({ person, rank, period, index, load }: { person: StaffPerformance; rank: number | null; period: PerformancePeriod; index: number; load?: Load }) {
  const r = person.rdv!;
  return (
    <PersonShell
      person={person}
      rank={rank}
      period={period}
      index={index}
      accent="from-sky-500 to-emerald-400"
      footer={
        <div className="space-y-3">
        <LoadBar load={load} />
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{r.accepted} acceptée{r.accepted > 1 ? "s" : ""}</span>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-600">{r.rejected} refusée{r.rejected > 1 ? "s" : ""}</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{r.visaAccepted} visa{r.visaAccepted > 1 ? "s" : ""} obtenu{r.visaAccepted > 1 ? "s" : ""}</span>
          {r.visaRejected > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-600">{r.visaRejected} visa refusé{r.visaRejected > 1 ? "s" : ""}</span>}
        </div>
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 gap-2">
          <Ring percent={r.acceptanceRate} color="#10b981" size={72} stroke={7}>
            <span className="text-center font-display text-sm font-extrabold leading-none text-dark">
              {r.acceptanceRate === null ? "—" : <CountUp value={r.acceptanceRate} suffix="%" />}
              <span className="mt-0.5 block text-[7px] font-bold uppercase tracking-wide text-muted">univ.</span>
            </span>
          </Ring>
          <Ring percent={r.visaAcceptanceRate} color="#0ea5e9" size={72} stroke={7}>
            <span className="text-center font-display text-sm font-extrabold leading-none text-dark">
              {r.visaAcceptanceRate === null ? "—" : <CountUp value={r.visaAcceptanceRate} suffix="%" />}
              <span className="mt-0.5 block text-[7px] font-bold uppercase tracking-wide text-muted">visa</span>
            </span>
          </Ring>
        </div>
        <div className="min-w-0">
          <p className="font-display text-3xl font-extrabold leading-none text-dark"><CountUp value={r.dossiers} /></p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted">dossiers</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat icon={Send} label="Prêt → déposé" value={r.readyToApplied.label} />
        <MiniStat icon={Timer} label="Déposé → décision" value={r.appliedToDecision.label} />
        <MiniStat icon={Clock} label="Docs visa → dépôt" value={r.visaDocsToSubmit.label} />
        <MiniStat icon={Flame} label="Mi-parcours" value={r.halfwayDossiers} warn={r.halfwayDossiers > 0} />
      </div>
    </PersonShell>
  );
}

function Team({ title, icon: Icon, count, children }: { title: string; icon: typeof Users; count: number; children: ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon className="h-4 w-4" aria-hidden /></span>
        {title}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-muted">{count}</span>
      </h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

export default function TeamPerformancePanel({ salesLoad = [], rdvLoad = [] }: { salesLoad?: Load[]; rdvLoad?: Load[] }) {
  const [period, setPeriod] = useState<PerformancePeriod>("30");
  const [data, setData] = useState<TeamPerformance | null>(null);
  const [error, setError] = useState("");
  const [showPending, setShowPending] = useState(false);

  useEffect(() => {
    setError("");
    fetchTeamPerformance(period)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger les statistiques."));
  }, [period]);

  const wa = data?.whatsapp;
  const sales = (data?.staff || []).filter((s) => s.sales).sort((a, b) => b.sales!.whatsapp.conversations - a.sales!.whatsapp.conversations || b.sales!.students - a.sales!.students);
  const rdv = (data?.staff || []).filter((s) => s.rdv).sort((a, b) => b.rdv!.dossiers - a.rdv!.dossiers);
  const rankOf = (index: number, value: number) => (value > 0 ? index + 1 : null);

  return (
    <section className="mt-6">
      {/* ── Bandeau ── */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-5 text-white shadow-[0_16px_40px_rgba(109,40,217,.25)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/75">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Performance
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold sm:text-3xl">Statistiques de l'équipe</h2>
            <p className="mt-1 max-w-xl text-sm text-white/80">WhatsApp, délais de traitement et dossiers bloqués, par employé.</p>
          </div>
          <div className="inline-flex rounded-xl bg-white/10 p-1 backdrop-blur" role="group" aria-label="Période">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPeriod(option.id)}
                aria-pressed={period === option.id}
                className={cn("rounded-lg px-3.5 py-1.5 text-xs font-bold transition", period === option.id ? "bg-white text-brand shadow" : "text-white/80 hover:text-white")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="relative mt-4 rounded-xl bg-red-500/20 px-4 py-3 text-sm text-white">{error}</p>}
        {!data && !error && <p className="relative mt-6 text-sm text-white/80">Chargement...</p>}

        {data && wa && (
          <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat
              icon={Timer}
              label="Temps moyen de réponse"
              hint={wa.reply.count ? `pour répondre aux étudiants, sur ${wa.reply.count} réponse${wa.reply.count > 1 ? "s" : ""}, en heures de travail` : "pas encore de donnée"}
            >
              <DurationValue label={wa.reply.label} />
            </GlassStat>
            <GlassStat icon={Clock} label="Heures de travail" hint="les durées ne comptent que ces jours et ces heures">
              <span className="text-2xl">{data.workHours.start}–{data.workHours.end}</span>
              <span className="mt-1 block text-xs font-bold text-white/80">{workDaysLabel(data.workHours.days)}</span>
            </GlassStat>
            <GlassStat icon={TrendingUp} label="Taux d'aboutissement" hint={`${wa.converted} aboutie${wa.converted > 1 ? "s" : ""} sur ${wa.answered} répondue${wa.answered > 1 ? "s" : ""}`}>
              {wa.conversionRate === null ? "—" : <CountUp value={wa.conversionRate} suffix=" %" />}
            </GlassStat>
            <GlassStat
              icon={AlertTriangle}
              label="En attente"
              hint="conversations qui attendent une réponse"
              warn={wa.pendingNow > 0}
              onClick={() => setShowPending((open) => !open)}
              active={showPending}
            >
              <span className="inline-flex items-center gap-2">
                <CountUp value={wa.pendingNow} />
                {wa.pendingNow > 0 && <span className="h-2.5 w-2.5 animate-ping rounded-full bg-amber-300" aria-hidden />}
              </span>
            </GlassStat>
          </div>
        )}
      </div>

      {data && wa && (
        <div className="mt-4 rounded-[28px] border border-line bg-white p-4 shadow-sm sm:p-6">
          {showPending && <div className="mb-6"><PendingConversationsList items={wa.pending} /></div>}

          {/* ── Entonnoir ── */}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-dark">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><MessageCircle className="h-4 w-4" aria-hidden /></span>
                Entonnoir WhatsApp
              </h3>
              <p className="mt-1 text-xs text-muted">De la première conversation à l'inscription : la pastille de droite montre la perte à chaque étape.</p>
              <div className="mt-4"><Funnel wa={wa} /></div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-violet-50 to-white p-5 text-center">
              <Ring percent={wa.conversionRate} color="#8b5cf6" size={150} stroke={14}>
                <span className="font-display text-4xl font-extrabold text-dark">
                  {wa.conversionRate === null ? "—" : <CountUp value={wa.conversionRate} suffix="%" />}
                </span>
              </Ring>
              <p className="mt-3 font-display text-base font-bold text-dark">Taux d'aboutissement</p>
              <p className="text-xs text-muted">{wa.converted} contact{wa.converted > 1 ? "s" : ""} abouti{wa.converted > 1 ? "s" : ""} sur {wa.answered} répondu{wa.answered > 1 ? "s" : ""}</p>
              {wa.unassigned > 0 && (
                <div className="mt-3">
                  <StatusChip count={wa.unassigned} label={wa.unassigned > 1 ? "conversations sans conseiller" : "conversation sans conseiller"} />
                </div>
              )}
            </div>
          </div>

          {sales.length > 0 && (
            <Team title="Conseillers" icon={Users} count={sales.length}>
              {sales.map((s, i) => (
                <SalesCard key={s.id} person={s} rank={rankOf(i, s.sales!.whatsapp.conversations)} period={period} index={i} load={salesLoad.find((l) => l.id === s.id)} />
              ))}
            </Team>
          )}
          {rdv.length > 0 && (
            <Team title="Responsables Visa" icon={UserCheck} count={rdv.length}>
              {rdv.map((s, i) => (
                <RdvCard key={s.id} person={s} rank={rankOf(i, s.rdv!.dossiers)} period={period} index={i} load={rdvLoad.find((l) => l.id === s.id)} />
              ))}
            </Team>
          )}

          <div className="mt-6">
            <WorkHoursNote workHours={data.workHours} />
          </div>
        </div>
      )}
    </section>
  );
}
