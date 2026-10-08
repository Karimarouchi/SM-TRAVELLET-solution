import { STAGE_LABELS_FR } from "@/components/MyCommissionsCard";
import { alertDialog, confirmDialog } from "@/components/ui/dialog-host";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  fetchCommissionPayouts,
  fetchCommissionsDue,
  formatMoney,
  payAllCommissions,
  payUserCommissions,
  type CommissionPayout,
  type CommissionRole,
  type DueEmployee,
  type DueSummary,
  type PayoutLine
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { BarChart3, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Coins, HandCoins, History, Search, Users, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CountUp } from "./anim";

const ROLE_LABEL: Record<CommissionRole, string> = { SALES: "Conseiller", RDV: "Responsable Dossier" };
const dt = (value: number) => formatMoney(value, "TND");
const frDate = (value: string) => new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function Kpi({ icon: Icon, label, children, hint, tone }: { icon: typeof Coins; label: string; children: React.ReactNode; hint: string; tone: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tone)}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold leading-none text-dark">{children}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </motion.div>
  );
}

function Lines({ lines, selectable, selected, onToggle }: { lines: PayoutLine[]; selectable?: boolean; selected?: string[]; onToggle?: (id: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-muted">
            {selectable && <th className="w-8 px-3 py-2" />}
            <th className="px-3 py-2">Étudiant</th>
            <th className="px-3 py-2">Étape</th>
            <th className="px-3 py-2">Pays</th>
            <th className="px-3 py-2">Gagnée le</th>
            <th className="px-3 py-2 text-right">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {lines.map((line) => (
            <tr key={line.id} className="transition hover:bg-brand/5">
              {selectable && (
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected?.includes(line.id)} onChange={() => onToggle?.(line.id)} className="h-4 w-4 accent-violet-600" aria-label={`Verser la commission de ${line.studentName}`} />
                </td>
              )}
              <td className="px-3 py-2 font-semibold text-dark">{line.studentName}</td>
              <td className="px-3 py-2 text-mid">{STAGE_LABELS_FR[line.stage]}</td>
              <td className="px-3 py-2 text-mid">{line.countryName}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{frDate(line.earnedAt)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-dark">{dt(line.amountDinar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, pageCount, setPage, label }: { page: number; pageCount: number; setPage: (p: number) => void; label: string }) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={label}>
      <p className="text-xs text-muted">Page {page} sur {pageCount}</p>
      <div className="flex items-center gap-1.5">
        <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Précédent
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" onClick={() => setPage(n)} aria-current={n === page ? "page" : undefined} className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition", n === page ? "bg-brand text-white shadow" : "border border-line bg-white text-mid hover:border-brand hover:text-brand")}>
            {n}
          </button>
        ))}
        <button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
          Suivant <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}

// Finance → Versements : ce qu'il reste à verser aux employés, et l'historique des versements.
export default function CommissionPayoutsPanel() {
  const [tab, setTab] = useState<"due" | "history">("due");
  const [due, setDue] = useState<{ employees: DueEmployee[]; totals: DueSummary } | null>(null);
  const [payouts, setPayouts] = useState<CommissionPayout[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [duePage, setDuePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [search, setSearch] = useState("");
  const now = new Date();
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [openPayout, setOpenPayout] = useState<string | null>(null);

  const loadDue = () => fetchCommissionsDue().then(setDue).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  const loadHistory = () => fetchCommissionPayouts({ year: year || undefined, month: month || undefined }).then((data) => setPayouts(data.payouts)).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));

  useEffect(() => {
    void loadDue();
  }, []);
  useEffect(() => {
    void loadHistory();
    setHistoryPage(1);
  }, [year, month]);
  useEffect(() => setHistoryPage(1), [search]);

  async function payEmployee(employee: DueEmployee, ids?: string[]) {
    const amount = ids ? employee.lines.filter((l) => ids.includes(l.id)).reduce((s, l) => s + l.amountDinar, 0) : employee.total;
    const count = ids ? ids.length : employee.count;
    const confirmed = await confirmDialog(`Marquer ${count} commission${count > 1 ? "s" : ""} (${dt(amount)}) comme versée${count > 1 ? "s" : ""} à ${employee.name} ? L'employé sera prévenu et le versement ajouté à l'historique.`, {
      title: "Payer les commissions ?",
      confirmLabel: "Payer",
      tone: "warning"
    });
    if (!confirmed) return;
    setBusy(employee.userId);
    try {
      await payUserCommissions(employee.userId, ids);
      setPicked((prev) => ({ ...prev, [employee.userId]: [] }));
      await Promise.all([loadDue(), loadHistory()]);
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : "Versement impossible.", { tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  async function payEveryone() {
    if (!due || !due.employees.length) return;
    const confirmed = await confirmDialog(`Verser toutes les commissions en attente : ${dt(due.totals.due)} à ${due.employees.length} employé${due.employees.length > 1 ? "s" : ""} ? Chaque employé reçoit son versement et sera prévenu.`, {
      title: "Payer tous les employés ?",
      confirmLabel: "Tout payer",
      tone: "warning"
    });
    if (!confirmed) return;
    setBusy("all");
    try {
      await payAllCommissions();
      await Promise.all([loadDue(), loadHistory()]);
    } catch (err) {
      void alertDialog(err instanceof Error ? err.message : "Versement impossible.", { tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  const employees = due?.employees || [];
  const DUE_PAGE = 5;
  const duePageCount = Math.max(1, Math.ceil(employees.length / DUE_PAGE));
  const currentDuePage = Math.min(duePage, duePageCount);
  const pagedEmployees = employees.slice((currentDuePage - 1) * DUE_PAGE, currentDuePage * DUE_PAGE);

  const filteredPayouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payouts.filter((p) => !q || p.userName.toLowerCase().includes(q) || p.number.toLowerCase().includes(q));
  }, [payouts, search]);
  const HISTORY_PAGE = 8;
  const historyPageCount = Math.max(1, Math.ceil(filteredPayouts.length / HISTORY_PAGE));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const pagedPayouts = filteredPayouts.slice((currentHistoryPage - 1) * HISTORY_PAGE, currentHistoryPage * HISTORY_PAGE);
  const historyTotal = filteredPayouts.reduce((sum, p) => sum + p.amountDinar, 0);

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!due) return <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />;

  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-[22px] border border-line bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark"><HandCoins className="h-5 w-5 text-brand" /> Commissions à verser</h2>
        <p className="mt-1 text-xs text-muted">
          Les commissions gagnées par les conseillers et les Responsables Dossier s'accumulent ici. Cliquez sur <strong>Payer</strong> une fois l'argent remis : le versement est daté et classé dans
          l'historique, et l'employé est prévenu. Les montants se règlent hors de l'application.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Wallet} label="Total à verser" hint="toutes périodes confondues" tone="bg-amber-100 text-amber-600">
          <CountUp value={due.totals.due} decimals={2} suffix=" DT" />
        </Kpi>
        <Kpi icon={Coins} label="Commissions en attente" hint="pas encore versées" tone="bg-violet-100 text-brand">
          <CountUp value={due.totals.dueCount} />
        </Kpi>
        <Kpi icon={Users} label="Employés concernés" hint="ont des commissions à recevoir" tone="bg-sky-100 text-sky-600">
          <CountUp value={due.totals.employees} />
        </Kpi>
        <Kpi icon={CheckCircle2} label="Versé ce mois-ci" hint={`${due.totals.payoutsThisMonth} versement${due.totals.payoutsThisMonth > 1 ? "s" : ""}`} tone="bg-emerald-100 text-emerald-600">
          <CountUp value={due.totals.paidThisMonth} decimals={2} suffix=" DT" />
        </Kpi>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-line bg-white p-0.5 shadow-sm">
          {([["due", "À verser", HandCoins], ["history", "Historique des versements", History]] as const).map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn("inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition", tab === id ? "bg-brand text-white" : "text-mid hover:text-brand")}>
              <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
        {tab === "due" && employees.length > 0 && (
          <button type="button" disabled={busy !== null} onClick={() => void payEveryone()} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50">
            <HandCoins className="h-4 w-4" /> {busy === "all" ? "Versement…" : `Payer tous les employés · ${dt(due.totals.due)}`}
          </button>
        )}
      </div>

      {tab === "due" ? (
        employees.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" /> Tout est à jour : aucune commission en attente de versement.
          </p>
        ) : (
          <>
            <div className="space-y-4">
              {pagedEmployees.map((employee, index) => {
                const isOpen = open === employee.userId;
                const selected = picked[employee.userId] || [];
                const selectedTotal = employee.lines.filter((l) => selected.includes(l.id)).reduce((sum, l) => sum + l.amountDinar, 0);
                return (
                  <motion.article key={employee.userId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.04 }} className="overflow-hidden rounded-[22px] border border-line bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar name={employee.name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate font-display text-base font-bold text-dark">{employee.name}</p>
                          <p className="truncate text-xs text-muted">{employee.email}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {employee.roles.map((role) => (
                              <span key={role} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-brand">{ROLE_LABEL[role]}</span>
                            ))}
                            {!employee.isActive && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-muted">Compte bloqué</span>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-extrabold leading-none text-dark">{dt(employee.total)}</p>
                        <p className="mt-1 text-[11px] text-muted">{employee.count} commission{employee.count > 1 ? "s" : ""} · depuis le {frDate(employee.oldestAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-slate-50/60 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" disabled={busy !== null} onClick={() => void payEmployee(employee)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                          <HandCoins className="h-3.5 w-3.5" /> {busy === employee.userId ? "Versement…" : `Payer tout · ${dt(employee.total)}`}
                        </button>
                        {selected.length > 0 && (
                          <button type="button" disabled={busy !== null} onClick={() => void payEmployee(employee, selected)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50">
                            Payer la sélection · {selected.length} · {dt(selectedTotal)}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={`/admin/equipe/${employee.userId}`} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand/10">
                          <BarChart3 className="h-3.5 w-3.5" /> Ses stats
                        </Link>
                        <button type="button" onClick={() => setOpen(isOpen ? null : employee.userId)} aria-expanded={isOpen} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-mid transition hover:border-brand hover:text-brand">
                          Détail <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="border-t border-line">
                        <Lines
                          lines={employee.lines}
                          selectable
                          selected={selected}
                          onToggle={(id) => setPicked((prev) => ({ ...prev, [employee.userId]: (prev[employee.userId] || []).includes(id) ? (prev[employee.userId] || []).filter((x) => x !== id) : [...(prev[employee.userId] || []), id] }))}
                        />
                      </div>
                    )}
                  </motion.article>
                );
              })}
            </div>
            <Pagination page={currentDuePage} pageCount={duePageCount} setPage={setDuePage} label="Pagination des commissions à verser" />
          </>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Employé ou n° de versement…" className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            </div>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Année" className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand">
              <option value={0}>Toutes les années</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} aria-label="Mois" className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand">
              <option value={0}>Tous les mois</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <p className="ml-auto text-xs text-muted">{filteredPayouts.length} versement{filteredPayouts.length > 1 ? "s" : ""} · <strong className="text-dark">{dt(historyTotal)}</strong></p>
          </div>

          {filteredPayouts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">Aucun versement sur cette période.</p>
          ) : (
            <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-muted">
                    <th className="px-5 py-3">N° versement</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Employé</th>
                    <th className="px-3 py-3 text-right">Commissions</th>
                    <th className="px-3 py-3 text-right">Montant</th>
                    <th className="px-3 py-3">Payé par</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pagedPayouts.map((payout) => {
                    const isOpen = openPayout === payout.id;
                    return (
                      <Fragment key={payout.id}>
                        <tr onClick={() => setOpenPayout(isOpen ? null : payout.id)} className="cursor-pointer border-b border-line/60 transition hover:bg-brand/5">
                          <td className="px-5 py-3 font-bold text-dark">{payout.number}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-mid">{frDate(payout.paidAt)}</td>
                          <td className="px-3 py-3 font-semibold text-dark">{payout.userName}</td>
                          <td className="px-3 py-3 text-right text-mid">{payout.count}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-emerald-700">{dt(payout.amountDinar)}</td>
                          <td className="px-3 py-3 text-mid">{payout.paidByName || "—"}</td>
                          <td className="px-3 py-3"><ChevronDown className={cn("h-4 w-4 text-muted transition-transform", isOpen && "rotate-180")} /></td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/60">
                            <td colSpan={7} className="px-2 py-2"><Lines lines={payout.lines} /></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={currentHistoryPage} pageCount={historyPageCount} setPage={setHistoryPage} label="Pagination de l'historique" />
        </>
      )}
    </div>
  );
}
