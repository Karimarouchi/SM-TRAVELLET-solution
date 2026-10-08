import { confirmDialog } from "@/components/ui/dialog-host";
import CommissionsPanel from "@/components/admin/CommissionsPanel";
import FinanceStatsSection from "@/components/admin/FinanceStats";
import { StatTile } from "@/components/admin/performance-ui";
import StudentPaymentsPanel from "@/components/StudentPaymentsPanel";
import { FancySelect } from "@/components/ui/fancy-select";
import {
  fetchFinanceOverview,
  fetchFinancePlans,
  fetchFinancePricing,
  formatMoney,
  removeFinancePricing,
  saveFinancePricing,
  type CountryPricing,
  type Currency,
  type FinanceOverview,
  type PaymentPlan
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import { AlertTriangle, BadgeCheck, Banknote, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Coins, Globe, Info, LayoutDashboard, Layers, Receipt, Save, Search, Tag, Trash2, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Tab = "apercu" | "paiements" | "tarifs" | "commissions";

const TABS: Array<{ id: Tab; label: string; icon: typeof Coins }> = [
  { id: "apercu", label: "Aperçu", icon: LayoutDashboard },
  { id: "paiements", label: "Paiements", icon: Receipt },
  { id: "tarifs", label: "Tarifs", icon: Tag },
  { id: "commissions", label: "Commissions", icon: Coins }
];

const CURRENCIES: Currency[] = ["TND", "EUR"];

// Plusieurs monnaies : une ligne par monnaie (« 12 000 DT · 800 € »).
function moneyLines(values: Partial<Record<Currency, number>>): string {
  const parts = CURRENCIES.filter((c) => values[c]).map((c) => formatMoney(values[c] || 0, c));
  return parts.length ? parts.join(" · ") : formatMoney(0, "TND");
}

function Overview() {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFinanceOverview().then(setData).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  if (error) return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return <div className="mx-auto mt-16 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-brand" />;

  const month: Partial<Record<Currency, number>> = {};
  const total: Partial<Record<Currency, number>> = {};
  for (const c of CURRENCIES) {
    if (data.collected[c]) {
      month[c] = data.collected[c]!.month;
      total[c] = data.collected[c]!.total;
    }
  }

  const Breakdown = ({ title, rows }: { title: string; rows: FinanceOverview["byCountry"] }) => (
    <section className="rounded-[24px] border border-line bg-white p-5 shadow-sm">
      <h3 className="font-display text-base font-bold text-dark">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Aucune donnée pour l'instant.</p>
      ) : (
        <div className="mt-3 divide-y divide-line/60">
          {rows.map((row) => {
            const collected: Partial<Record<Currency, number>> = {};
            const remaining: Partial<Record<Currency, number>> = {};
            for (const c of CURRENCIES) {
              const bucket = row.byCurrency[c];
              if (bucket) {
                collected[c] = bucket.collected;
                remaining[c] = bucket.remaining;
              }
            }
            return (
              <div key={row.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                <span className="font-semibold text-dark">{row.name}</span>
                <span className="text-xs">
                  <span className="font-bold text-emerald-700">{moneyLines(collected)}</span> encaissés ·{" "}
                  <span className="font-bold text-amber-700">{moneyLines(remaining)}</span> restants
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Encaissé ce mois" value={moneyLines(month)} />
        <StatTile label="Encaissé au total" value={moneyLines(total)} />
        <StatTile label="Reste à encaisser" value={moneyLines(data.remaining)} tone={Object.values(data.remaining).some(Boolean) ? "warning" : "default"} />
        <StatTile
          label="Étudiants en retard"
          value={data.lateCount}
          hint={`sur ${data.planCount} plan${data.planCount > 1 ? "s" : ""} de paiement`}
          tone={data.lateCount ? "warning" : "default"}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Breakdown title="Par pays" rows={data.byCountry} />
        <Breakdown title="Par conseiller" rows={data.bySales} />
      </div>
      <FinanceStatsSection />
    </div>
  );
}

const STATUS_FILTERS = [
  { value: "", label: "Tous" },
  { value: "late", label: "En retard" },
  { value: "UNPAID", label: "Impayé" },
  { value: "PARTIAL", label: "Partiel" },
  { value: "PAID", label: "Payé" }
];

function Payments({ initialStudent }: { initialStudent: string | null }) {
  const [plans, setPlans] = useState<PaymentPlan[] | null>(null);
  const [pricing, setPricing] = useState<CountryPricing[]>([]);
  const [status, setStatus] = useState("");
  const [countryId, setCountryId] = useState("");
  const [salesId, setSalesId] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(initialStudent);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetchFinancePricing().then(setPricing).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchFinancePlans({ status, countryId, salesId, q: search })
        .then(setPlans)
        .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [status, countryId, salesId, search, version]);

  // Conseillers présents dans les plans, pour le filtre.
  const salesOptions = useMemo(() => {
    const map = new Map<string, string>();
    (plans || []).forEach((p) => p.salesId && map.set(p.salesId, p.salesName || "Conseiller"));
    return [{ value: "", label: "Tous les conseillers" }, ...[...map.entries()].map(([value, label]) => ({ value, label }))];
  }, [plans]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-bold transition",
              status === f.value ? "border-brand bg-brand text-white" : "border-line bg-white text-mid hover:border-brand/40"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FancySelect
          value={countryId}
          onChange={setCountryId}
          options={[{ value: "", label: "Tous les pays" }, ...pricing.map((c) => ({ value: c.countryId, label: c.countryName }))]}
        />
        <FancySelect value={salesId} onChange={setSalesId} options={salesOptions} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un étudiant…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {!plans ? (
          <div className="mx-auto mt-10 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        ) : plans.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-muted">
            Aucun plan de paiement ne correspond. Les plans se créent quand un conseiller génère un code d'inscription pour un pays qui a un tarif, ou quand un paiement est enregistré sur la fiche d'un étudiant.
          </p>
        ) : (
          plans.map((plan) => {
            const isOpen = open === plan.studentId;
            return (
              <div key={plan.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : plan.studentId)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-dark">{plan.studentName}</span>
                    <span className="block truncate text-[11px] text-muted">
                      {plan.countryName} · {plan.salesName || "Sans conseiller"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-mid">
                      T1 {plan.tranche1.complete ? "✓" : formatMoney(plan.tranche1.remaining, plan.currency)} · T2 {plan.tranche2.complete ? "✓" : formatMoney(plan.tranche2.remaining, plan.currency)}
                    </span>
                    {plan.status === "PAID" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        <BadgeCheck className="h-3 w-3" /> Payé
                      </span>
                    ) : plan.late ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                        <AlertTriangle className="h-3 w-3" /> En retard
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">{plan.status === "PARTIAL" ? "Partiel" : "Impayé"}</span>
                    )}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-line bg-slate-50 px-4 pb-4">
                    <StudentPaymentsPanel studentId={plan.studentId} onChanged={() => setVersion((v) => v + 1)} />
                    <Link to={`/conseiller/etudiants/${plan.studentId}`} className="mt-3 inline-block text-xs font-bold text-brand underline">
                      Ouvrir la fiche de l'étudiant
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const parseAmount = (value: string) => Number(value.replace(/\s/g, "").replace(",", ".")) || 0;
const PRESETS = [500, 1000, 1500, 2000];

function PricingCard({ row, onSaved, index }: { row: CountryPricing; onSaved: (next: CountryPricing) => void; index: number }) {
  const [currency, setCurrency] = useState<Currency>(row.currency);
  const [tranche1, setTranche1] = useState(row.tranche1 === null ? "" : String(row.tranche1));
  const [tranche2, setTranche2] = useState(row.tranche2 === null ? "" : String(row.tranche2));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const t1 = parseAmount(tranche1);
  const t2 = parseAmount(tranche2);
  const total = t1 + t2;
  const symbol = currency === "EUR" ? "€" : "DT";
  const dirty = !row.configured || currency !== row.currency || t1 !== (row.tranche1 ?? 0) || t2 !== (row.tranche2 ?? 0);
  const canSave = dirty && total > 0 && !busy;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await saveFinancePricing(row.countryId, { currency, tranche1: t1, tranche2: t2 });
      onSaved(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirmDialog(`Supprimer le tarif de ${row.countryName} ? Les étudiants déjà engagés gardent leur tarif ; les nouveaux codes ne demanderont plus de paiement.`, { tone: "danger", confirmLabel: "Supprimer" }))) return;
    setBusy(true);
    setError("");
    try {
      const next = await removeFinancePricing(row.countryId);
      onSaved(next);
      setTranche1("");
      setTranche2("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  const amountField = (label: string, hint: string, value: string, set: (v: string) => void) => (
    <div>
      <label className="mb-1 flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        <span>{label}</span>
        <span className="font-medium normal-case tracking-normal">{hint}</span>
      </label>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => set(e.target.value.replace(/[^\d.,\s]/g, ""))}
          inputMode="decimal"
          placeholder="0"
          className="w-full rounded-xl border border-line bg-slate-50 py-2.5 pl-3 pr-12 font-display text-lg font-extrabold text-dark outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">{symbol}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {PRESETS.map((amount) => (
          <button key={amount} type="button" onClick={() => set(String(amount))} className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold text-mid transition hover:border-brand hover:text-brand">
            {amount}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-[22px] border bg-white p-5 shadow-sm transition-shadow hover:shadow-lg", dirty && row.configured ? "border-amber-300" : "border-line")}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", row.configured ? "from-emerald-500 to-emerald-300" : "from-slate-300 to-slate-200")} />

      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-xs font-extrabold text-white shadow-sm">{row.code}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold text-dark">{row.countryName}</h3>
          {row.configured ? (
            <p className="text-[11px] font-bold text-emerald-600">Tarif défini · {formatMoney((row.tranche1 ?? 0) + (row.tranche2 ?? 0), row.currency)}</p>
          ) : (
            <p className="text-[11px] font-semibold text-muted">Aucun tarif · aucun paiement exigé</p>
          )}
        </div>
        <div className="inline-flex shrink-0 rounded-full border border-line bg-slate-50 p-0.5" role="group" aria-label="Monnaie">
          {(["TND", "EUR"] as Currency[]).map((c) => (
            <button key={c} type="button" onClick={() => setCurrency(c)} aria-pressed={currency === c} className={cn("rounded-full px-3 py-1 text-xs font-bold transition", currency === c ? "bg-brand text-white shadow" : "text-mid hover:text-brand")}>
              {c === "EUR" ? "€" : "DT"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {amountField("Tranche 1", "à l'inscription", tranche1, setTranche1)}
        {amountField("Tranche 2", "avant le visa", tranche2, setTranche2)}
      </div>

      {/* Aperçu : répartition des deux tranches et prix total */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Prix total pour l'étudiant</p>
            <p className="font-display text-2xl font-extrabold leading-tight text-dark">{formatMoney(total, currency)}</p>
          </div>
          {total > 0 && (
            <p className="text-right text-[11px] text-muted">
              <span className="font-bold text-brand">{Math.round((t1 / total) * 100)}%</span> puis <span className="font-bold text-sky-600">{Math.round((t2 / total) * 100)}%</span>
            </p>
          )}
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
          <motion.div className="h-full bg-brand" animate={{ width: total ? `${(t1 / total) * 100}%` : "0%" }} transition={{ duration: 0.4 }} />
          <motion.div className="h-full bg-sky-400" animate={{ width: total ? `${(t2 / total) * 100}%` : "0%" }} transition={{ duration: 0.4 }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand" /> Inscription {formatMoney(t1, currency)}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" /> Visa {formatMoney(t2, currency)}</span>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-h-[1.25rem] text-xs font-bold">
          {saved ? (
            <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Enregistré</span>
          ) : dirty && row.configured ? (
            <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="h-3.5 w-3.5" /> Modifications non enregistrées</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {row.configured && (
            <button type="button" disabled={busy} onClick={remove} aria-label={`Supprimer le tarif de ${row.countryName}`} title="Supprimer le tarif" className="rounded-xl bg-red-50 p-2 text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-60">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button type="button" disabled={!canSave} onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="h-3.5 w-3.5" /> {busy ? "Enregistrement…" : row.configured ? "Enregistrer" : "Définir le tarif"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

const PRICING_PAGE_SIZE = 4;

function Pricing() {
  const [rows, setRows] = useState<CountryPricing[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "set" | "unset">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchFinancePricing().then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."));
  }, []);

  const configured = (rows || []).filter((r) => r.configured);
  const averages = (["TND", "EUR"] as Currency[])
    .map((c) => {
      const list = configured.filter((r) => r.currency === c);
      return list.length ? { currency: c, average: list.reduce((s, r) => s + (r.tranche1 ?? 0) + (r.tranche2 ?? 0), 0) / list.length } : null;
    })
    .filter(Boolean) as Array<{ currency: Currency; average: number }>;

  const visible = (rows || []).filter((r) => {
    if (filter === "set" && !r.configured) return false;
    if (filter === "unset" && r.configured) return false;
    const q = search.trim().toLowerCase();
    return !q || r.countryName.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
  });

  // 4 pays par page ; retour à la première page quand la recherche ou le filtre change.
  useEffect(() => {
    setPage(1);
  }, [search, filter]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PRICING_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = visible.slice((currentPage - 1) * PRICING_PAGE_SIZE, currentPage * PRICING_PAGE_SIZE);

  return (
    <div className="mt-6 space-y-5">
      {/* Résumé + principe */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-[22px] border border-line bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-dark"><Layers className="h-5 w-5 text-brand" /> Comment fonctionne le tarif</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-violet-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand">Tranche 1 · inscription</p>
              <p className="mt-1 text-xs text-mid">Encaissée à l'inscription : le conseiller la confirme en créant le code.</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600">Tranche 2 · visa</p>
              <p className="mt-1 text-xs text-mid">Encaissée avant le dépôt du dossier visa : sans elle, le dépôt est bloqué.</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Le tarif est figé pour chaque étudiant à son inscription : modifier un prix ne change pas les étudiants déjà engagés.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-line bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><Globe className="h-3.5 w-3.5" /> Pays avec tarif</p>
            <p className="mt-2 font-display text-3xl font-extrabold leading-none text-dark">{configured.length}<span className="text-lg text-muted"> / {rows?.length ?? 0}</span></p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: rows?.length ? `${(configured.length / rows.length) * 100}%` : "0%" }} transition={{ duration: 0.6 }} />
            </div>
          </div>
          <div className="rounded-[22px] border border-line bg-white p-4 shadow-sm">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><Wallet className="h-3.5 w-3.5" /> Prix moyen</p>
            {averages.length === 0 ? (
              <p className="mt-2 text-sm text-muted">—</p>
            ) : (
              <div className="mt-2 space-y-0.5">
                {averages.map((a) => <p key={a.currency} className="font-display text-xl font-extrabold leading-tight text-dark">{formatMoney(Math.round(a.average), a.currency)}</p>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* Recherche + filtres */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Chercher un pays…" className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </div>
        <div className="inline-flex rounded-full border border-line bg-white p-0.5 shadow-sm">
          {([["all", "Tous"], ["set", "Avec tarif"], ["unset", "Sans tarif"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold transition", filter === id ? "bg-brand text-white" : "text-mid hover:text-brand")}>{label}</button>
          ))}
        </div>
      </div>

      {!rows ? (
        <div className="mx-auto mt-10 h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">Aucun pays ne correspond.</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {paged.map((row, i) => (
              <PricingCard key={`${row.countryId}:${row.configured}`} row={row} index={i} onSaved={(next) => setRows((prev) => (prev || []).map((r) => (r.countryId === next.countryId ? next : r)))} />
            ))}
          </div>
          {visible.length > PRICING_PAGE_SIZE && (
            <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Pagination des tarifs">
              <p className="text-xs text-muted">
                Pays {(currentPage - 1) * PRICING_PAGE_SIZE + 1}–{Math.min(currentPage * PRICING_PAGE_SIZE, visible.length)} sur {visible.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Précédent
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? "page" : undefined}
                    className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition", n === currentPage ? "bg-brand text-white shadow" : "border border-line bg-white text-mid hover:border-brand hover:text-brand")}
                  >
                    {n}
                  </button>
                ))}
                <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-mid transition hover:border-brand hover:text-brand disabled:opacity-40">
                  Suivant <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const student = searchParams.get("student");
  const [tab, setTab] = useState<Tab>(
    requested === "paiements" || requested === "tarifs" || requested === "commissions" ? requested : student ? "paiements" : "apercu"
  );

  // Un lien (ex. alerte « paiement non réglé ») peut changer l'onglet sans recharger la page.
  useEffect(() => {
    if (requested === "paiements" || requested === "tarifs" || requested === "commissions") setTab(requested);
    else if (student) setTab("paiements");
  }, [requested, student]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setSearchParams(next === "apercu" ? {} : { tab: next }, { replace: true });
  };

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6">
      <section className="rounded-[28px] bg-gradient-to-br from-brand-dark via-brand to-violet-500 p-6 text-white shadow-[0_16px_40px_rgba(109,40,217,.22)] sm:p-8">
        <p className="text-sm text-white/80">Espace administrateur</p>
        <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-extrabold">
          <Banknote className="h-8 w-8" aria-hidden /> Finance
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85">
          Chiffre d'affaires, paiements des étudiants en 2 tranches (inscription puis visa), tarifs par pays et commissions de l'équipe.
        </p>
        <div className="relative mt-6 grid grid-cols-3 gap-1 rounded-xl bg-white/10 p-1 backdrop-blur sm:inline-flex sm:items-center">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:px-4",
                tab === item.id ? "bg-white text-brand shadow" : "text-white/80 hover:text-white"
              )}
            >
              <item.icon className="h-3.5 w-3.5 shrink-0" /> {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "apercu" && <Overview />}
      {tab === "paiements" && <Payments key={student || "all"} initialStudent={student} />}
      {tab === "tarifs" && <Pricing />}
      {tab === "commissions" && <CommissionsPanel />}
    </main>
  );
}
