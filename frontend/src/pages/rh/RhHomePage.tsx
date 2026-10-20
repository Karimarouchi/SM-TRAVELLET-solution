import LeaveCoverDialog from "@/components/rh/LeaveCoverDialog";
import { decideHrLeave, fetchHrInbox, type HrInbox } from "@/lib/hr";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  FileWarning,
  HeartPulse,
  Palmtree,
  Users,
  Wallet
} from "lucide-react";
import { animate, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

const money = (value: number) => `${value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} DT`;
const fr = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

const SHORTCUTS = [
  { href: "/admin/rh/employes", icon: Users, title: "Employés", text: "Contrat, embauche, salaire, CIN et RIB." },
  { href: "/admin/rh/conges", icon: Palmtree, title: "Congés", text: "Soldes, demandes et années ouvertes." },
  { href: "/admin/rh/presences", icon: Clock, title: "Présences", text: "Retards, départs et absences à valider." },
  { href: "/admin/rh/paie", icon: Wallet, title: "Paie", text: "Fiches du mois, primes et attestations." },
  { href: "/admin/rh/absences", icon: HeartPulse, title: "Absences", text: "Certificats et retenues de salaire." },
  { href: "/admin/rh/parametres", icon: CalendarDays, title: "Règles", text: "Jours fériés, préavis, signature et cachet." }
];

type Tone = "danger" | "warning" | "accent";

type Action = {
  id: string;
  tone: Tone;
  icon: typeof Clock;
  title: string;
  detail: string;
  amount?: string;
  href: string;
  action: string;
  leaveId?: string;
};

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 0.8, ease: "easeOut", onUpdate: (next) => setShown(next) });
    return () => controls.stop();
  }, [inView, value]);

  return <span ref={ref}>{Math.round(shown).toLocaleString("fr-FR")}{suffix}</span>;
}

function Bar({ percent, className }: { percent: number; className: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", className)} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

function Kpi({ icon: Icon, title, tone, children }: { icon: typeof Clock; title: string; tone: string; children: ReactNode }) {
  return (
    <article className="min-w-0 rounded-[24px] border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <h3 className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted">{title}</h3>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function actionsOf(inbox: HrInbox): Action[] {
  const items: Action[] = [];
  for (const row of inbox.lateCertificates) {
    items.push({
      id: `cert-${row.userId}-${row.day}`,
      tone: "danger",
      icon: FileWarning,
      title: `${row.prenom} ${row.nom}`,
      detail: `Certificat hors délai · ${fr(row.day)}`,
      href: `/admin/rh/absences?user=${row.userId}`,
      action: "Examiner"
    });
  }
  for (const row of inbox.leave) {
    items.push({
      id: `leave-${row.id}`,
      tone: "warning",
      icon: Palmtree,
      title: `${row.prenom} ${row.nom}`,
      detail: `Congé · ${fr(row.startOn)} – ${fr(row.endOn)} · ${row.days} j${row.reason ? ` · ${row.reason}` : ""}`,
      href: `/admin/rh/conges?user=${row.userId}`,
      action: "Décider",
      leaveId: row.id
    });
  }
  for (const row of inbox.contracts) {
    items.push({
      id: `cdd-${row.userId}`,
      tone: row.daysLeft <= 7 ? "danger" : "warning",
      icon: CalendarClock,
      title: `${row.prenom} ${row.nom}`,
      detail: row.daysLeft === 0 ? "CDD terminé aujourd'hui" : `Fin de CDD dans ${row.daysLeft} jour${row.daysLeft > 1 ? "s" : ""} · ${fr(row.contractEndsOn)}`,
      href: `/admin/rh/employes?user=${row.userId}`,
      action: "Ouvrir la fiche"
    });
  }
  const byPerson = new Map<string, { name: string; days: number }>();
  for (const row of inbox.absences) {
    const current = byPerson.get(row.userId) || { name: `${row.prenom} ${row.nom}`, days: 0 };
    current.days += 1;
    byPerson.set(row.userId, current);
  }
  for (const [userId, row] of byPerson) {
    items.push({
      id: `abs-${userId}`,
      tone: "warning",
      icon: Clock,
      title: row.name,
      detail: `${row.days} jour${row.days > 1 ? "s" : ""} d'absence à valider`,
      href: `/admin/rh/presences?user=${userId}`,
      action: "Valider"
    });
  }
  if (inbox.summary.openYears > 0) {
    items.push({
      id: "years",
      tone: "accent",
      icon: Palmtree,
      title: "Années de congé ouvertes",
      detail: `${inbox.summary.openYears} année${inbox.summary.openYears > 1 ? "s" : ""} à reporter ou à payer`,
      href: "/admin/rh/conges",
      action: "Régler"
    });
  }
  if (inbox.summary.incomplete > 0) {
    items.push({
      id: "fiches",
      tone: "accent",
      icon: Users,
      title: "Fiches incomplètes",
      detail: `${inbox.summary.incomplete} personne${inbox.summary.incomplete > 1 ? "s" : ""} sans contrat ou sans date d'embauche`,
      href: "/admin/rh/employes",
      action: "Compléter"
    });
  }
  for (const row of inbox.documentRequests || []) {
    items.push({
      id: `doc-${row.id}`,
      tone: "accent",
      icon: FileText,
      title: `${row.prenom} ${row.nom}`,
      detail: row.kind === "WORK" ? "Attestation de travail à valider" : row.hasFiche === false ? `Fiche de paie ${monthLabel(row.month || "")} demandée : ce mois n'a pas encore de fiche` : `Fiche de paie ${monthLabel(row.month || "")} à valider`,
      href: `/admin/rh/paie?user=${row.userId}`,
      action: "Valider"
    });
  }
  for (const row of inbox.payrollDrafts) {
    items.push({
      id: `pay-${row.userId}`,
      tone: "accent",
      icon: Wallet,
      title: `${row.prenom} ${row.nom}`,
      detail: "Fiche de paie en brouillon",
      amount: money(row.net),
      href: `/admin/rh/paie?user=${row.userId}`,
      action: "Ouvrir"
    });
  }
  if (!inbox.summary.payroll.hasSignature || !inbox.summary.payroll.hasStamp) {
    const missing = [!inbox.summary.payroll.hasSignature && "la signature", !inbox.summary.payroll.hasStamp && "le cachet"].filter(Boolean).join(" et ");
    items.push({
      id: "brand",
      tone: "warning",
      icon: FileWarning,
      title: "Signature ou cachet manquant",
      detail: `Déposez ${missing} avant d'imprimer les fiches.`,
      href: "/admin/rh/parametres",
      action: "Déposer"
    });
  }
  return items;
}

const TONE = {
  danger: {
    card: "border-red-100 bg-gradient-to-r from-red-50 to-white hover:border-red-200",
    icon: "bg-red-500",
    chip: "bg-red-100 text-red-700",
    link: "text-red-700"
  },
  warning: {
    card: "border-amber-100 bg-gradient-to-r from-amber-50 to-white hover:border-amber-200",
    icon: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700",
    link: "text-amber-700"
  },
  accent: {
    card: "border-orange-100 bg-gradient-to-r from-orange-50 to-white hover:border-orange-200",
    icon: "bg-orange-500",
    chip: "bg-orange-100 text-orange-700",
    link: "text-orange-700"
  }
};

export default function RhHomePage() {
  const [inbox, setInbox] = useState<HrInbox | null>(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    fetchHrInbox().then(setInbox).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 20_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  const actions = useMemo(() => (inbox ? actionsOf(inbox) : []), [inbox]);
  const summary = inbox?.summary;
  const waiting = actions.length;
  const blur = revealed ? "" : "select-none blur-[8px]";
  const payable = summary ? summary.payroll.drafts + summary.payroll.issued : 0;
  const issuedRate = payable ? Math.round((summary!.payroll.issued / payable) * 100) : 0;

  // Accepter : la fenêtre des remplaçants s'ouvre (directement acceptée si personne n'est à remplacer).
  const [approving, setApproving] = useState<HrInbox["leave"][number] | null>(null);

  const decide = async (id: string, status: "APPROVED" | "REJECTED") => {
    setBusyId(id);
    setError("");
    try {
      await decideHrLeave(id, status);
      const next = await fetchHrInbox();
      setInbox(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Décision impossible.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
      <section className="rounded-[28px] bg-gradient-to-br from-orange-700 via-orange-500 to-amber-400 p-6 text-white shadow-[0_16px_40px_rgba(234,88,12,.22)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm text-white/80">Espace RH</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">Tableau de bord</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              {summary
                ? `${monthLabel(summary.month)}. Effectifs, congés, présences et paie du mois.`
                : "Effectifs, congés, présences et paie du mois."}
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/75">À traiter</p>
            <p className="font-display text-3xl font-extrabold leading-none">{inbox ? waiting : "–"}</p>
          </div>
        </div>
      </section>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-dark">Indicateurs clés</h2>
            <p className="mt-0.5 text-xs text-muted">{revealed ? "Montants visibles pendant 20 secondes." : "Chiffres du mois en cours. Les montants restent masqués."}</p>
          </div>
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-xs font-bold text-mid transition hover:border-orange-400 hover:text-orange-700"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {revealed ? "Masquer les montants" : "Afficher les montants"}
          </button>
        </div>

        {!summary ? (
          <div className="mx-auto mt-10 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-orange-500" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} title="Effectif" tone="bg-orange-100 text-orange-600">
              <p className="font-display text-4xl font-extrabold leading-none text-dark"><CountUp value={summary.headcount} /></p>
              <p className="mt-1 text-[11px] text-muted">personnes dans l'agence</p>
              <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <p className="flex items-center justify-between"><span className="text-muted">Fiches prêtes</span><strong className="text-dark">{summary.ready}</strong></p>
                <p className="flex items-center justify-between"><span className="text-muted">À compléter</span><strong className={summary.incomplete ? "text-orange-700" : "text-dark"}>{summary.incomplete}</strong></p>
                <p className="flex items-center justify-between"><span className="text-muted">En congé aujourd'hui</span><strong className="text-dark">{summary.onLeave.length}</strong></p>
              </div>
            </Kpi>

            <Kpi icon={Palmtree} title="Congés" tone="bg-amber-100 text-amber-600">
              <p className="font-display text-4xl font-extrabold leading-none text-dark"><CountUp value={inbox.leave.length} /></p>
              <p className="mt-1 text-[11px] text-muted">demande{inbox.leave.length > 1 ? "s" : ""} à accepter</p>
              <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <p className="flex items-center justify-between"><span className="text-muted">Années à solder</span><strong className={summary.openYears ? "text-amber-700" : "text-dark"}>{summary.openYears}</strong></p>
                {summary.onLeave.slice(0, 2).map((row) => (
                  <p key={row.userId} className="truncate text-dark">{row.prenom} {row.nom} <span className="text-muted">jusqu'au {fr(row.endOn)}</span></p>
                ))}
                {summary.onLeave.length > 2 && <p className="text-muted">+ {summary.onLeave.length - 2} autre{summary.onLeave.length - 2 > 1 ? "s" : ""}</p>}
                {summary.onLeave.length === 0 && <p className="text-muted">Personne en congé aujourd'hui.</p>}
              </div>
            </Kpi>

            <Kpi icon={Clock} title="Présences" tone="bg-rose-100 text-rose-600">
              <p className="font-display text-4xl font-extrabold leading-none text-dark"><CountUp value={inbox.absences.length} /></p>
              <p className="mt-1 text-[11px] text-muted">jour{inbox.absences.length > 1 ? "s" : ""} à confirmer</p>
              <div className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                <p className="flex items-center justify-between"><span className="text-muted">Minutes retenues</span><strong className="text-dark">{summary.presenceMinutes.toLocaleString("fr-FR")}</strong></p>
                <p className="flex items-center justify-between"><span className="text-muted">Coût du mois</span><strong className={cn("text-rose-600 transition", blur)}>{money(summary.presenceCost)}</strong></p>
                <p className="text-[11px] text-muted">Les absences non validées ne comptent pas encore.</p>
              </div>
            </Kpi>

            <Kpi icon={Wallet} title={`Paie · ${monthLabel(summary.month)}`} tone="bg-emerald-100 text-emerald-600">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={cn("font-display text-2xl font-extrabold leading-none text-dark transition", blur)}>{money(summary.payroll.net)}</p>
                  <p className="mt-1 text-[11px] text-muted">net des personnes embauchées</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">{issuedRate}% émises</span>
              </div>
              <div className="mt-4">
                <Bar percent={issuedRate} className="bg-emerald-500" />
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <p className="flex items-center justify-between"><span className="text-muted">Brouillons</span><strong className={summary.payroll.drafts ? "text-orange-700" : "text-dark"}>{summary.payroll.drafts}</strong></p>
                <p className="flex items-center justify-between"><span className="text-muted">Émises</span><strong className="text-dark">{summary.payroll.issued}</strong></p>
                <p className="flex items-center justify-between"><span className="text-muted">Commissions, hors net</span><strong className={cn("text-dark transition", blur)}>{money(summary.payroll.commissions)}</strong></p>
              </div>
            </Kpi>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="rounded-[24px] border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-dark">Actions prioritaires</h2>
              <p className="mt-0.5 text-xs text-muted">Ce qui attend une décision, regroupé par personne.</p>
            </div>
            {waiting > 0 && (
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-orange-500 px-2 text-[11px] font-bold text-white">{waiting}</span>
            )}
          </div>
          <div className="-mx-2 mt-5 max-h-[520px] space-y-3 overflow-y-auto px-2 py-1 pr-3">
            {actions.map((item) => {
              const tone = TONE[item.tone];
              const Icon = item.icon;
              const body = (
                <>
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white", tone.icon)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[15px] font-bold text-dark">{item.title}</span>
                    <span className={cn("mt-2 inline-flex max-w-full items-center gap-1 truncate rounded-lg px-2.5 py-1 text-[11px] font-semibold", tone.chip)}>
                      {item.detail}
                      {item.amount && <span className={cn("transition", blur)}>{item.amount}</span>}
                    </span>
                    {item.leaveId ? (
                      <span className="mt-2 flex flex-wrap gap-1">
                        <button type="button" disabled={busyId === item.leaveId} onClick={() => setApproving(inbox?.leave.find((row) => row.id === item.leaveId) || null)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">Accepter</button>
                        <button type="button" disabled={busyId === item.leaveId} onClick={() => void decide(item.leaveId!, "REJECTED")} className="rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 disabled:opacity-60">Refuser</button>
                      </span>
                    ) : (
                      <span className={cn("mt-2 flex items-center gap-1 text-[11px] font-bold", tone.link)}>
                        {item.action} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
                      </span>
                    )}
                  </span>
                </>
              );
              if (item.leaveId) {
                return (
                  <article key={item.id} className={cn("flex items-start gap-4 rounded-2xl border p-4", tone.card)}>
                    {body}
                  </article>
                );
              }
              return (
                <Link key={item.id} to={item.href} className={cn("group flex items-start gap-4 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]", tone.card)}>
                  {body}
                </Link>
              );
            })}
            {inbox && actions.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-700">Rien n'attend</p>
                  <p className="text-xs text-emerald-600">Congés, absences, contrats et fiches sont à jour.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {summary && (
          <div className="space-y-4">
            <section className="rounded-[24px] border border-line bg-white p-6">
              <h2 className="font-display text-xl font-bold text-dark">Contrats</h2>
              <p className="mt-0.5 text-xs text-muted">Répartition de l'effectif.</p>
              <div className="mt-5 space-y-3">
                {([
                  ["CDI", summary.contracts.CDI, "bg-orange-500"],
                  ["CIVP", summary.contracts.CIVP, "bg-amber-400"],
                  ["CDD", summary.contracts.CDD, "bg-rose-400"],
                  ["Sans contrat", summary.contracts.none, "bg-slate-300"]
                ] as const).map(([label, count, color]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-dark">{label}</span>
                      <span className="text-xs text-muted">{count}</span>
                    </div>
                    <Bar percent={summary.headcount ? (count / summary.headcount) * 100 : 0} className={color} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-line bg-white p-6">
              <h2 className="font-display text-xl font-bold text-dark">Ce mois-ci</h2>
              <div className="mt-4 space-y-3 text-sm">
                <p className="flex items-start justify-between gap-3">
                  <span className="text-muted">Prochain jour férié</span>
                  <span className="text-right font-semibold text-dark">
                    {summary.nextHoliday ? `${summary.nextHoliday.label} · ${fr(summary.nextHoliday.day)}` : "Aucun"}
                    {summary.nextHoliday && (
                      <span className={cn("mt-1 block text-[11px]", summary.nextHoliday.paid ? "text-emerald-700" : "text-rose-600")}>
                        {summary.nextHoliday.paid ? "Payé" : "Impayé"}
                      </span>
                    )}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted">Retenues du mois</span>
                  <strong className={cn("text-dark transition", blur)}>{money(summary.payroll.deductions)}</strong>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted">Signature</span>
                  <strong className={summary.payroll.hasSignature ? "text-emerald-700" : "text-amber-700"}>{summary.payroll.hasSignature ? "Déposée" : "Manquante"}</strong>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-muted">Cachet</span>
                  <strong className={summary.payroll.hasStamp ? "text-emerald-700" : "text-amber-700"}>{summary.payroll.hasStamp ? "Déposé" : "Manquant"}</strong>
                </p>
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SHORTCUTS.map((card) => (
          <Link key={card.href} to={card.href} className="rounded-[24px] border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300">
            <card.icon className="h-5 w-5 text-orange-600" aria-hidden />
            <h2 className="mt-3 font-display text-lg font-bold text-dark">{card.title}</h2>
            <p className="mt-1 text-sm text-muted">{card.text}</p>
          </Link>
        ))}
      </div>
      {approving && (
        <LeaveCoverDialog
          employeeName={`${approving.prenom} ${approving.nom}`.trim()}
          userId={approving.userId}
          startOn={approving.startOn}
          endOn={approving.endOn}
          leaveId={approving.id}
          mode="approve"
          onConfirm={async (plan) => {
            await decideHrLeave(approving.id, "APPROVED", plan);
            setInbox(await fetchHrInbox());
          }}
          onClose={() => setApproving(null)}
        />
      )}
    </main>
  );
}
