import { StatTile } from "@/components/admin/performance-ui";
import {
  fetchFinanceStats,
  fetchPaymentJournal,
  formatMoney,
  PAYMENT_METHOD_LABELS,
  type Currency,
  type FinanceStats,
  type PaymentMethod,
  type StudentPayment
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";

const PAYMENTS_PAGE_SIZE = 10;
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "CARD", "CHEQUE"];
const METHOD_COLORS: Record<PaymentMethod, string> = { CASH: "bg-emerald-500", TRANSFER: "bg-sky-500", CARD: "bg-violet-500", CHEQUE: "bg-amber-500" };

type Metrics = {
  collected: number;
  count: number;
  tranche1: number;
  tranche2: number;
  methods: Record<PaymentMethod, number>;
  cancelledCount: number;
  cancelledAmount: number;
  billed: number;
  plans: number;
};

const EMPTY: Metrics = { collected: 0, count: 0, tranche1: 0, tranche2: 0, methods: { CASH: 0, TRANSFER: 0, CARD: 0, CHEQUE: 0 }, cancelledCount: 0, cancelledAmount: 0, billed: 0, plans: 0 };

// Cumule les mois dont la clé (YYYY-MM) commence par `prefix` : « 2026 » = année, « 2026-03 » = mois.
function aggregate(data: FinanceStats, currency: Currency, prefix: string): Metrics {
  const out: Metrics = { ...EMPTY, methods: { ...EMPTY.methods } };
  for (const row of data.months) {
    if (row.currency !== currency || !row.month.startsWith(prefix)) continue;
    out.collected += row.collected;
    out.count += row.count;
    out.tranche1 += row.tranche1;
    out.tranche2 += row.tranche2;
    for (const m of METHODS) out.methods[m] += row.methods[m];
    out.cancelledCount += row.cancelledCount;
    out.cancelledAmount += row.cancelledAmount;
  }
  for (const row of data.billed) {
    if (row.currency !== currency || !row.month.startsWith(prefix)) continue;
    out.billed += row.due;
    out.plans += row.plans;
  }
  return out;
}

function ranking(rows: FinanceStats["byCountry"], currency: Currency, prefix: string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.currency !== currency || !row.month.startsWith(prefix)) continue;
    map.set(row.name, (map.get(row.name) || 0) + row.collected);
  }
  return [...map.entries()].map(([name, collected]) => ({ name, collected })).sort((a, b) => b.collected - a.collected);
}

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) return <span className="text-[11px] text-muted">= {label}</span>;
  if (previous === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600"><ArrowUpRight className="h-3 w-3" /> nouveau vs {label}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold", up ? "text-emerald-600" : "text-rose-500")}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? "+" : ""}{pct}% vs {label}
    </span>
  );
}

function RankingCard({ title, rows, currency, empty }: { title: string; rows: Array<{ name: string; collected: number }>; currency: Currency; empty: string }) {
  const max = Math.max(...rows.map((r) => r.collected), 1);
  return (
    <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
      <h3 className="font-display text-base font-bold text-dark">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.name}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-semibold text-dark">{row.name}</span>
                <span className="shrink-0 font-bold text-emerald-700">{formatMoney(row.collected, currency)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  key={`${row.name}-${row.collected}`}
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, (row.collected / max) * 100)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function FinanceStatsSection() {
  const now = new Date();
  const [data, setData] = useState<FinanceStats | null>(null);
  const [journal, setJournal] = useState<StudentPayment[]>([]);
  const [error, setError] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(0); // 0 = toute l'année
  const [currency, setCurrency] = useState<Currency>("TND");
  const [paymentsPage, setPaymentsPage] = useState(1);

  useEffect(() => {
    fetchFinanceStats().then(setData).catch((err) => setError(err instanceof Error ? err.message : "Statistiques indisponibles."));
    fetchPaymentJournal().then(setJournal).catch(() => undefined);
  }, []);

  const currencies = useMemo<Currency[]>(() => {
    const found = new Set<Currency>();
    data?.months.forEach((m) => found.add(m.currency));
    data?.billed.forEach((m) => found.add(m.currency));
    return (["TND", "EUR"] as Currency[]).filter((c) => found.has(c));
  }, [data]);

  useEffect(() => setPaymentsPage(1), [year, month, currency]);

  useEffect(() => {
    if (currencies.length && !currencies.includes(currency)) setCurrency(currencies[0]);
  }, [currencies, currency]);

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    data?.months.forEach((m) => set.add(Number(m.month.slice(0, 4))));
    return [...set].sort((a, b) => a - b);
  }, [data]);

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const prefix = month ? monthKey(year, month) : String(year);
  const previousPrefix = month ? (month === 1 ? monthKey(year - 1, 12) : monthKey(year, month - 1)) : String(year - 1);
  const previousLabel = month ? (month === 1 ? `${MONTHS[11].toLowerCase()} ${year - 1}` : MONTHS[month - 2].toLowerCase()) : String(year - 1);
  const periodLabel = month ? `${MONTHS[month - 1]} ${year}` : `Année ${year}`;

  const current = aggregate(data, currency, prefix);
  const previous = aggregate(data, currency, previousPrefix);
  const average = current.count ? current.collected / current.count : 0;
  const methodTotal = METHODS.reduce((s, m) => s + current.methods[m], 0);

  const yearRows = MONTHS.map((_, i) => ({ index: i + 1, ...aggregate(data, currency, monthKey(year, i + 1)) }));
  const lastYearRows = MONTHS.map((_, i) => aggregate(data, currency, monthKey(year - 1, i + 1)));
  const chartMax = Math.max(...yearRows.map((r) => r.collected), ...lastYearRows.map((r) => r.collected), 1);
  const yearTotal = aggregate(data, currency, String(year));

  const countries = ranking(data.byCountry, currency, prefix);
  const sales = ranking(data.bySales, currency, prefix);

  const payments = journal
    .filter((p) => p.currency === currency && p.paidAt.startsWith(prefix))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const paymentsPageCount = Math.max(1, Math.ceil(payments.length / PAYMENTS_PAGE_SIZE));
  const currentPaymentsPage = Math.min(paymentsPage, paymentsPageCount);
  const pagedPayments = payments.slice((currentPaymentsPage - 1) * PAYMENTS_PAGE_SIZE, currentPaymentsPage * PAYMENTS_PAGE_SIZE);

  return (
    <section className="space-y-6">
      {/* ── Sélecteur de période ── */}
      <div className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-dark">Statistiques des paiements</h2>
            <p className="mt-0.5 text-xs text-muted">Choisissez une année, puis un mois, pour tout voir en détail.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currencies.length > 1 && (
              <div className="inline-flex rounded-full border border-line bg-slate-50 p-0.5">
                {currencies.map((c) => (
                  <button key={c} type="button" onClick={() => setCurrency(c)} className={cn("rounded-full px-3 py-1 text-xs font-bold transition", currency === c ? "bg-brand text-white" : "text-mid hover:text-brand")}>
                    {c === "EUR" ? "Euro €" : "Dinar DT"}
                  </button>
                ))}
              </div>
            )}
            <div className="inline-flex items-center gap-1 rounded-full border border-line bg-slate-50 px-1 py-0.5">
              <button type="button" aria-label="Année précédente" disabled={year <= years[0]} onClick={() => setYear(year - 1)} className="rounded-full p-1.5 text-mid transition hover:bg-white hover:text-brand disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[3.5rem] text-center font-display text-sm font-bold text-dark">{year}</span>
              <button type="button" aria-label="Année suivante" disabled={year >= years[years.length - 1]} onClick={() => setYear(year + 1)} className="rounded-full p-1.5 text-mid transition hover:bg-white hover:text-brand disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setMonth(0)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition", month === 0 ? "border-brand bg-brand text-white" : "border-line text-mid hover:border-brand hover:text-brand")}>
            Toute l'année
          </button>
          {SHORT.map((label, i) => {
            const has = yearRows[i].count > 0 || yearRows[i].cancelledCount > 0 || yearRows[i].billed > 0;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setMonth(i + 1)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  month === i + 1 ? "border-brand bg-brand text-white" : has ? "border-line text-dark hover:border-brand hover:text-brand" : "border-line/60 text-muted/70 hover:border-brand hover:text-brand"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── KPI de la période ── */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{periodLabel}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Encaissé" value={formatMoney(current.collected, currency)} hint={<Delta current={current.collected} previous={previous.collected} label={previousLabel} />} />
          <StatTile label="Paiements reçus" value={current.count} hint={<Delta current={current.count} previous={previous.count} label={previousLabel} />} />
          <StatTile label="Paiement moyen" value={formatMoney(average, currency)} hint="par paiement encaissé" />
          <StatTile label="Facturé (plans créés)" value={formatMoney(current.billed, currency)} hint={`${current.plans} plan${current.plans > 1 ? "s" : ""} de paiement`} />
          <StatTile label="Tranche 1 · inscription" value={formatMoney(current.tranche1, currency)} hint={current.collected ? `${Math.round((current.tranche1 / current.collected) * 100)}% de l'encaissé` : "—"} />
          <StatTile label="Tranche 2 · visa" value={formatMoney(current.tranche2, currency)} hint={current.collected ? `${Math.round((current.tranche2 / current.collected) * 100)}% de l'encaissé` : "—"} />
          <StatTile label="Paiements annulés" value={current.cancelledCount} hint={current.cancelledCount ? formatMoney(current.cancelledAmount, currency) : "aucune annulation"} tone={current.cancelledCount ? "warning" : "default"} />
          <StatTile label={`Total ${year}`} value={formatMoney(yearTotal.collected, currency)} hint={`${yearTotal.count} paiement${yearTotal.count > 1 ? "s" : ""} sur l'année`} />
        </div>
      </div>

      {/* ── Graphique de l'année ── */}
      <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-dark">Encaissements mois par mois · {year}</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" /> {year}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" /> {year - 1}</span>
          </div>
        </div>
        <div className="mt-5 flex h-56 items-end gap-1.5 sm:gap-3">
          {yearRows.map((row, i) => {
            const height = (row.collected / chartMax) * 100;
            const lastHeight = (lastYearRows[i].collected / chartMax) * 100;
            const selected = month === row.index;
            return (
              <button
                key={row.index}
                type="button"
                onClick={() => setMonth(selected ? 0 : row.index)}
                title={`${MONTHS[i]} : ${formatMoney(row.collected, currency)}`}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className={cn("hidden text-[10px] font-bold transition sm:block", selected ? "text-brand" : "text-muted opacity-0 group-hover:opacity-100")}>
                  {row.collected ? formatMoney(row.collected, currency) : ""}
                </span>
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <motion.div
                    className="w-1/3 rounded-t-md bg-slate-200 transition-colors group-hover:bg-slate-300"
                    initial={{ height: 0 }}
                    animate={{ height: `${lastHeight}%` }}
                    transition={{ duration: 0.7, delay: i * 0.03, ease: "easeOut" }}
                  />
                  <motion.div
                    className={cn("w-1/2 rounded-t-md transition-colors", selected ? "bg-brand" : "bg-brand/60 group-hover:bg-brand")}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, row.collected ? 2 : 0)}%` }}
                    transition={{ duration: 0.7, delay: i * 0.03, ease: "easeOut" }}
                  />
                </div>
                <span className={cn("text-[10px] font-bold", selected ? "text-brand" : "text-muted")}>{SHORT[i]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Modes de paiement + pays / conseillers ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
          <h3 className="font-display text-base font-bold text-dark">Modes de paiement</h3>
          {methodTotal === 0 ? (
            <p className="mt-3 text-sm text-muted">Aucun paiement sur cette période.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {METHODS.map((m) => (
                <div key={m}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-dark">{PAYMENT_METHOD_LABELS[m]}</span>
                    <span className="text-muted">{formatMoney(current.methods[m], currency)} · {Math.round((current.methods[m] / methodTotal) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      key={`${m}-${prefix}-${current.methods[m]}`}
                      className={cn("h-full rounded-full", METHOD_COLORS[m])}
                      initial={{ width: 0 }}
                      animate={{ width: `${(current.methods[m] / methodTotal) * 100}%` }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <RankingCard title="Par pays" rows={countries} currency={currency} empty="Aucun encaissement sur cette période." />
        <RankingCard title="Par conseiller" rows={sales} currency={currency} empty="Aucun encaissement sur cette période." />
      </div>

      {/* ── Tableau mensuel de l'année ── */}
      <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <h3 className="font-display text-base font-bold text-dark">Détail mensuel · {year}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                <th className="py-2 pr-3">Mois</th>
                <th className="py-2 pr-3 text-right">Paiements</th>
                <th className="py-2 pr-3 text-right">Encaissé</th>
                <th className="py-2 pr-3 text-right">Tranche 1</th>
                <th className="py-2 pr-3 text-right">Tranche 2</th>
                <th className="py-2 text-right">Annulés</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map((row, i) => (
                <tr
                  key={row.index}
                  onClick={() => setMonth(month === row.index ? 0 : row.index)}
                  className={cn("cursor-pointer border-b border-line/50 transition hover:bg-slate-50", month === row.index && "bg-brand/5")}
                >
                  <td className="py-2 pr-3 font-semibold text-dark">{MONTHS[i]}</td>
                  <td className="py-2 pr-3 text-right text-mid">{row.count}</td>
                  <td className="py-2 pr-3 text-right font-bold text-emerald-700">{formatMoney(row.collected, currency)}</td>
                  <td className="py-2 pr-3 text-right text-mid">{formatMoney(row.tranche1, currency)}</td>
                  <td className="py-2 pr-3 text-right text-mid">{formatMoney(row.tranche2, currency)}</td>
                  <td className={cn("py-2 text-right", row.cancelledCount ? "font-semibold text-amber-600" : "text-muted")}>{row.cancelledCount}</td>
                </tr>
              ))}
              <tr className="font-bold text-dark">
                <td className="pt-3 pr-3">Total {year}</td>
                <td className="pt-3 pr-3 text-right">{yearTotal.count}</td>
                <td className="pt-3 pr-3 text-right text-emerald-700">{formatMoney(yearTotal.collected, currency)}</td>
                <td className="pt-3 pr-3 text-right">{formatMoney(yearTotal.tranche1, currency)}</td>
                <td className="pt-3 pr-3 text-right">{formatMoney(yearTotal.tranche2, currency)}</td>
                <td className="pt-3 text-right">{yearTotal.cancelledCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Paiements de la période ── */}
      <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-dark">Paiements · {periodLabel}</h3>
          <span className="text-xs text-muted">{payments.length} paiement{payments.length > 1 ? "s" : ""}</span>
        </div>
        {payments.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Aucun paiement sur cette période.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Étudiant</th>
                  <th className="py-2 pr-3">Pays</th>
                  <th className="py-2 pr-3">Tranche</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Reçu</th>
                  <th className="py-2 pr-3">Référence</th>
                  <th className="py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {pagedPayments.map((p) => (
                  <tr key={p.id} className={cn("border-b border-line/50", p.status === "CANCELLED" && "text-muted line-through")}>
                    <td className="py-2 pr-3 text-mid">{new Date(p.paidAt).toLocaleDateString("fr-FR")}</td>
                    <td className="py-2 pr-3 font-semibold">{p.studentName || "—"}</td>
                    <td className="py-2 pr-3">{p.countryName}</td>
                    <td className="py-2 pr-3">{p.tranche === 1 ? "Inscription" : "Visa"}</td>
                    <td className="py-2 pr-3">{p.methodLabel}</td>
                    <td className="py-2 pr-3 text-muted">{p.receiptNumber || "—"}</td>
                    <td className="py-2 pr-3 text-muted">{p.reference ? `${p.referenceLabel ? `${p.referenceLabel} ` : ""}${p.reference}` : "—"}</td>
                    <td className="py-2 text-right font-bold">{formatMoney(p.amount, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {payments.length > PAYMENTS_PAGE_SIZE && (
          <nav className="mt-3 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination des paiements">
            <p className="text-xs text-muted">
              Paiements {(currentPaymentsPage - 1) * PAYMENTS_PAGE_SIZE + 1}–{Math.min(currentPaymentsPage * PAYMENTS_PAGE_SIZE, payments.length)} sur {payments.length}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" disabled={currentPaymentsPage === 1} onClick={() => setPaymentsPage(currentPaymentsPage - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Précédent
              </button>
              {Array.from({ length: paymentsPageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPaymentsPage(n)}
                  aria-current={n === currentPaymentsPage ? "page" : undefined}
                  className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition", n === currentPaymentsPage ? "bg-brand text-white shadow" : "border border-line bg-white text-mid hover:border-brand hover:text-brand")}
                >
                  {n}
                </button>
              ))}
              <button type="button" disabled={currentPaymentsPage === paymentsPageCount} onClick={() => setPaymentsPage(currentPaymentsPage + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
                Suivant <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </nav>
        )}
      </section>
    </section>
  );
}
